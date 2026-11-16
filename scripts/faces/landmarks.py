#!/usr/bin/env python3
"""Face landmarks and person segmentation for one photo, entirely locally.

Writes, into <out_dir>:
  landmarks.json  478 face landmarks (x, y normalised to the photo's width and
                  height from the top-left, z on roughly the same scale as x,
                  smaller is nearer the camera), the 4x4 facial transformation
                  matrix, and the 852 face-mesh triangles as landmark indices.
  segments.png    the segmentation category mask at photo resolution, one
                  8-bit class index per pixel: 0 background, 1 hair, 2 body
                  skin, 3 face skin, 4 clothes, 5 other (accessories).

prepare-portrait.mjs reads both when a portrait config sets `landmarks`.

Models (Apache-2.0, Google MediaPipe), downloaded once into --models:
  https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task
  https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite

Usage:
  python3 -m venv scripts/faces/.venv
  scripts/faces/.venv/bin/pip install -r scripts/faces/requirements.txt
  scripts/faces/.venv/bin/python scripts/faces/landmarks.py <photo> <out_dir> \
      [--models scripts/faces/models]
"""

import argparse
import json
import os

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks.python import BaseOptions, vision

HERE = os.path.dirname(os.path.abspath(__file__))
CLASSES = ["background", "hair", "body skin", "face skin", "clothes", "other"]


def load_rgb(path):
    """Upright sRGB photo; transparent cutouts are flattened onto black, as in
    prepare-portrait.mjs."""
    image = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    if image is None:
        raise SystemExit(f"cannot read {path}")
    if image.ndim == 2:
        image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
    if image.dtype != np.uint8:
        image = (image / 257).astype(np.uint8)
    if image.shape[2] == 4:
        alpha = image[:, :, 3:4].astype(np.float32) / 255
        image = np.round(image[:, :, :3] * alpha).astype(np.uint8)
    return np.ascontiguousarray(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))


def detect_landmarks(rgb, model):
    options = vision.FaceLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=model),
        num_faces=1,
        output_facial_transformation_matrixes=True,
    )
    with vision.FaceLandmarker.create_from_options(options) as landmarker:
        result = landmarker.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb))
    if not result.face_landmarks:
        raise SystemExit("no face found")
    points = [[p.x, p.y, p.z] for p in result.face_landmarks[0]]
    matrix = np.asarray(result.facial_transformation_matrixes[0]).tolist()
    return points, matrix


def segment(rgb, model):
    """Per-class confidence at the input's resolution."""
    options = vision.ImageSegmenterOptions(
        base_options=BaseOptions(model_asset_path=model),
        output_confidence_masks=True,
    )
    with vision.ImageSegmenter.create_from_options(options) as segmenter:
        image = mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(rgb))
        result = segmenter.segment(image)
    return np.stack(
        [m.numpy_view().astype(np.float32).reshape(rgb.shape[:2]) for m in result.confidence_masks], -1
    )


def segment_refined(rgb, points, model):
    """The segmenter runs at 256x256, so a whole photo leaves the face and neck
    boundaries coarse. Segment a square around the head too and blend its
    confidences in with a feathered window."""
    height, width = rgb.shape[:2]
    full = segment(rgb, model)
    xs = np.array([p[0] for p in points]) * width
    ys = np.array([p[1] for p in points]) * height
    face = max(xs.max() - xs.min(), ys.max() - ys.min())
    side = int(round(face * 2.6))
    cx = (xs.min() + xs.max()) / 2
    cy = (ys.min() + ys.max()) / 2 + face * 0.25
    x0 = int(round(np.clip(cx - side / 2, 0, max(0, width - side))))
    y0 = int(round(np.clip(cy - side / 2, 0, max(0, height - side))))
    x1 = min(width, x0 + side)
    y1 = min(height, y0 + side)
    crop = segment(rgb[y0:y1, x0:x1], model)
    ramp = max(8, side // 10)
    wy = np.clip(np.minimum(np.arange(y1 - y0) + 0.5, y1 - y0 - np.arange(y1 - y0) - 0.5) / ramp, 0, 1)
    wx = np.clip(np.minimum(np.arange(x1 - x0) + 0.5, x1 - x0 - np.arange(x1 - x0) - 0.5) / ramp, 0, 1)
    # Photo edges are real edges, not seams: keep the crop's result there.
    if y0 == 0:
        wy[: (y1 - y0) // 2] = 1
    if y1 == height:
        wy[(y1 - y0) // 2 :] = 1
    if x0 == 0:
        wx[: (x1 - x0) // 2] = 1
    if x1 == width:
        wx[(x1 - x0) // 2 :] = 1
    weight = (wy[:, None] * wx[None, :])[..., None]
    blended = full.copy()
    blended[y0:y1, x0:x1] = weight * crop + (1 - weight) * full[y0:y1, x0:x1]
    return np.argmax(blended, -1).astype(np.uint8), [x0, y0, x1 - x0, y1 - y0]


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("photo")
    parser.add_argument("out_dir")
    parser.add_argument(
        "--models",
        default=os.path.join(HERE, "models"),
        help="directory holding face_landmarker.task and selfie_multiclass_256x256.tflite",
    )
    args = parser.parse_args()
    landmarker = os.path.join(args.models, "face_landmarker.task")
    segmenter = os.path.join(args.models, "selfie_multiclass_256x256.tflite")
    for model in (landmarker, segmenter):
        if not os.path.exists(model):
            raise SystemExit(f"missing {model}; download it from the URLs in this script's header")

    rgb = load_rgb(args.photo)
    height, width = rgb.shape[:2]
    points, matrix = detect_landmarks(rgb, landmarker)
    classes, refine_box = segment_refined(rgb, points, segmenter)

    # The tessellation lists each triangle as three consecutive edges.
    tessellation = vision.FaceLandmarksConnections.FACE_LANDMARKS_TESSELATION
    triangles = [
        [tessellation[i].start, tessellation[i + 1].start, tessellation[i + 2].start]
        for i in range(0, len(tessellation), 3)
    ]

    os.makedirs(args.out_dir, exist_ok=True)
    with open(os.path.join(args.out_dir, "landmarks.json"), "w") as f:
        json.dump(
            {
                "photo": os.path.basename(args.photo),
                "width": width,
                "height": height,
                "model": "mediapipe face_landmarker (float16)",
                "description": "x, y normalised to the photo from its top-left; z is relative depth on the scale of x, smaller is nearer.",
                "landmarks": [[round(v, 6) for v in p] for p in points],
                "transformationMatrix": [[round(v, 6) for v in row] for row in matrix],
                "triangles": triangles,
                "segments": {
                    "file": "segments.png",
                    "model": "mediapipe selfie_multiclass_256x256",
                    "classes": CLASSES,
                    "refinedBox": refine_box,
                },
            },
            f,
        )
    cv2.imwrite(os.path.join(args.out_dir, "segments.png"), classes)
    counts = np.bincount(classes.ravel(), minlength=len(CLASSES))
    print(f"landmarks {len(points)} points, {len(triangles)} triangles ({width}x{height})")
    print("segments  " + ", ".join(f"{name} {c / classes.size:.1%}" for name, c in zip(CLASSES, counts)))


if __name__ == "__main__":
    main()
