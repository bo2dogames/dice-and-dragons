import { useEffect, useState } from 'react'
import { resolveMedia } from '../lib/sharedSessions'

export default function MediaImage({ source, alt, className }: { source: string; alt: string; className?: string }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    let active = true
    void resolveMedia(source).then((value) => { if (active) setUrl(value) }).catch((error) => console.error('Unable to load saved image', error))
    return () => { active = false }
  }, [source])
  return url ? <img src={url} alt={alt} className={className} /> : <div aria-label={alt} className={className} />
}

