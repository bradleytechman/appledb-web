export function siteUrl(url) {
  if (!url || /^(?:[a-z]+:)?\/\//i.test(url)) return url
  const base = import.meta.env.BASE_URL || '/'
  const prefix = base.endsWith('/') ? base.slice(0, -1) : base
  return `${prefix}${url.startsWith('/') ? url : `/${url}`}`
}
