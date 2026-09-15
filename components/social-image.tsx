import type { SocialImageData } from '../lib/social-image'

// Image-renderer markup, independent of the site's second-pass visual theme.
export function socialTitleStyle(title: string) {
  return {
    fontFamily: 'Geist',
    fontSize: title.length > 70 ? 48 : title.length > 45 ? 56 : 64,
    fontWeight: 700,
    lineHeight: 1.08,
    letterSpacing: -1.5,
    textAlign: 'center' as const
  }
}

export function SocialImage({
  data,
  titleWidth
}: {
  data: SocialImageData
  titleWidth: number
}) {
  const description =
    data.description.length > 140
      ? data.description.slice(0, 137).replace(/\s+\S*$/, '') + '…'
      : data.description
  const date = new Date(data.published)
  const published = Number.isNaN(date.valueOf())
    ? ''
    : date.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC'
      })
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#24252d',
        fontFamily: 'Geist',
        color: '#202126'
      }}
    >
      {data.cover ? (
        <img
          src={data.cover}
          alt=''
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
            filter: 'blur(6px)',
            transform: 'scale(1.03)'
          }}
        />
      ) : null}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.14)'
        }}
      />
      <div
        style={{
          position: 'relative',
          width: 960,
          height: 466,
          display: 'flex',
          border: '14px solid rgba(0,0,0,0.28)',
          borderRadius: 8
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            backgroundColor: '#ffffff',
            padding: '32px 42px',
            textAlign: 'center'
          }}
        >
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: 2,
              color: '#65666e'
            }}
          >
            {data.siteName.toUpperCase()}
          </div>
          <div
            style={{
              flex: 1,
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 18
            }}
          >
            <div
              style={{
                ...socialTitleStyle(data.title),
                width: titleWidth,
                textWrap: 'balance',
                overflow: 'hidden',
                display: 'block'
              }}
            >
              {data.title}
            </div>
            {data.description ? (
              <div
                style={{
                  fontSize: 23,
                  lineHeight: 1.35,
                  color: '#62636c',
                  maxWidth: 780,
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical'
                }}
              >
                {description}
              </div>
            ) : null}
          </div>
          <div
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 20,
              color: '#65666e',
              borderTop: '1px solid #e6e6e9',
              paddingTop: 20
            }}
          >
            <span>{data.author}</span>
            <span>{published || data.domain}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
