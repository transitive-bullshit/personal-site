import { execFile } from 'node:child_process'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import sharp from 'sharp'

const exec = promisify(execFile)

// Decode only the first frame. FFmpeg applies rotation before the filter;
// square pixels make the saved dimensions match the browser's display ratio.
export async function inspectVideo(bytes: Buffer) {
  const directory = await mkdtemp(join(tmpdir(), 'personal-site-video-'))
  try {
    const input = join(directory, 'input')
    await writeFile(input, bytes)
    const { stdout } = await exec(
      'ffmpeg',
      [
        '-nostdin',
        '-v',
        'error',
        '-protocol_whitelist',
        'file,pipe',
        '-i',
        input,
        '-map',
        '0:v:0',
        '-frames:v',
        '1',
        '-vf',
        'scale=round(iw*sar):ih,setsar=1',
        '-f',
        'image2pipe',
        '-c:v',
        'png',
        'pipe:1'
      ],
      { encoding: 'buffer', timeout: 60_000, maxBuffer: 64 * 1024 * 1024 }
    )
    const frame = sharp(stdout, { limitInputPixels: 100_000_000 })
    const { width, height } = await frame.metadata()
    if (!width || !height) throw new Error('Video has no decodable frame')
    const poster = await frame
      .resize({
        width: 1280,
        height: 1280,
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true })
    return { width, height, poster }
  } catch (err) {
    throw new Error(
      'Unable to inspect video; content sync requires FFmpeg on PATH and a decodable video',
      { cause: err }
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}
