import { describe, expect, it } from 'vitest'
import { buildNotificationEmail, escapeHtml } from '../src/lib/email'

describe('notification email HTML', () => {
  it('escapes every user-provided text value', () => {
    const html = buildNotificationEmail(
      'ACME <script>alert("company")</script>',
      'Thread <img src=x onerror=alert(1)>',
      [{ label: '<b>De</b>', value: `Alice & Bob <script>alert('row')</script>` }]
    )

    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<img src=x')
    expect(html).not.toContain('<b>De</b>')
    expect(html).toContain('&lt;script&gt;alert(&quot;company&quot;)&lt;/script&gt;')
    expect(html).toContain('Alice &amp; Bob &lt;script&gt;alert(&#39;row&#39;)&lt;/script&gt;')
  })

  it('renders an explicit link while escaping its URL and text', () => {
    const html = buildNotificationEmail('ACME', 'Invitation', [
      {
        label: 'Activation',
        link: { href: 'https://example.com/activate?token=a&next="inbox"', text: 'Ouvrir <maintenant>' },
      },
    ])

    expect(html).toContain('href="https://example.com/activate?token=a&amp;next=&quot;inbox&quot;"')
    expect(html).toContain('Ouvrir &lt;maintenant&gt;')
  })

  it('escapes all five HTML-sensitive characters', () => {
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;')
  })
})
