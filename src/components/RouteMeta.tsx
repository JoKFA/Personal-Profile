import { useEffect } from 'react'

interface RouteMetaProps {
  title: string
  description: string
}

function upsertMeta(name: string, content: string, selector: string, attribute: 'name' | 'property') {
  let element = document.head.querySelector<HTMLMetaElement>(selector)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, name)
    document.head.appendChild(element)
  }
  element.content = content
}

export function RouteMeta({ title, description }: RouteMetaProps) {
  useEffect(() => {
    document.title = title

    upsertMeta('description', description, 'meta[name="description"]', 'name')
    upsertMeta('og:title', title, 'meta[property="og:title"]', 'property')
    upsertMeta('og:description', description, 'meta[property="og:description"]', 'property')
    upsertMeta('og:image', '/og-card.svg', 'meta[property="og:image"]', 'property')
    upsertMeta('twitter:card', 'summary_large_image', 'meta[name="twitter:card"]', 'name')

    if (!window.location.hostname.startsWith('127.') && window.location.hostname !== 'localhost') {
      const href = `${window.location.origin}${window.location.pathname}${window.location.hash}`
      let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
      if (!canonical) {
        canonical = document.createElement('link')
        canonical.rel = 'canonical'
        document.head.appendChild(canonical)
      }
      canonical.href = href
      upsertMeta('og:url', href, 'meta[property="og:url"]', 'property')
    }
  }, [description, title])

  return null
}
