// Small helper for talking to the Django API.
// Every request sends the login cookie and Django's CSRF token automatically.

// Sent when the server says nobody is logged in (for example, the session timed out).
export const SESSION_EXPIRED_EVENT = 'sr-session-expired'

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message)
    this.status = status
    this.data = data
  }
}

function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^|; )' + name + '=([^;]*)'))
  return match ? decodeURIComponent(match[2]) : ''
}

export async function api(path, { method = 'GET', body } = {}) {
  const response = await fetch('/api' + path, {
    method,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': getCookie('csrftoken'),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const data = await response.json().catch(() => null)
  if (response.status === 401) {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
  }
  if (!response.ok) {
    const message = (data && data.detail) || 'Something went wrong. Please try again.'
    throw new ApiError(message, response.status, data)
  }
  return data
}
