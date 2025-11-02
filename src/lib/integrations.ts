/**
 * External app integrations
 */

export interface ExportOptions {
  format: 'notion' | 'gmail' | 'ical' | 'json';
  includeAudio?: boolean;
  includeTags?: boolean;
}

/**
 * Export note to Notion format
 */
export async function exportToNotion(note: any): Promise<string> {
  const notionContent = `# ${note.title}

${note.content || 'No content'}

${note.duration ? `Duration: ${Math.floor(note.duration / 60)}:${String(Math.floor(note.duration % 60)).padStart(2, '0')}` : ''}
${note.tags && note.tags.length > 0 ? `Tags: ${note.tags.join(', ')}` : ''}
Created: ${new Date(note.created_at).toLocaleString()}
`;

  return notionContent;
}

/**
 * Export note to Gmail format (HTML email)
 */
export async function exportToGmail(note: any): Promise<string> {
  const htmlEmail = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .header { background-color: #f4f4f4; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
    .content { padding: 20px; }
    .meta { color: #666; font-size: 14px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${note.title}</h1>
  </div>
  <div class="content">
    ${note.content ? `<p>${note.content.replace(/\n/g, '</p><p>')}</p>` : '<p>No content</p>'}
  </div>
  <div class="meta">
    ${note.duration ? `<p>Duration: ${Math.floor(note.duration / 60)}:${String(Math.floor(note.duration % 60)).padStart(2, '0')}</p>` : ''}
    ${note.tags && note.tags.length > 0 ? `<p>Tags: ${note.tags.join(', ')}</p>` : ''}
    <p>Created: ${new Date(note.created_at).toLocaleString()}</p>
  </div>
</body>
</html>
`;

  return htmlEmail;
}

/**
 * Export note to iCal format
 */
export async function exportToICal(note: any): Promise<string> {
  const startDate = new Date(note.created_at);
  const endDate = new Date(startDate.getTime() + (note.duration ? note.duration * 1000 : 0));

  const ical = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Sonic Note Maker//Voice Note//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:${note.id}@sonic-note-maker
DTSTAMP:${startDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTSTART:${startDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTEND:${endDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z
SUMMARY:${note.title}
DESCRIPTION:${(note.content || '').replace(/\n/g, '\\n')}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR
`;

  return ical;
}

/**
 * Send note via Gmail (opens Gmail compose window)
 */
export function sendViaGmail(note: any): void {
  const subject = encodeURIComponent(note.title);
  const body = encodeURIComponent(`${note.content || 'No content'}\n\nCreated: ${new Date(note.created_at).toLocaleString()}`);
  const mailtoLink = `https://mail.google.com/mail/?view=cm&fs=1&to=&su=${subject}&body=${body}`;
  window.open(mailtoLink, '_blank');
}

/**
 * Generate Zapier webhook payload
 */
export function generateZapierPayload(note: any): any {
  return {
    id: note.id,
    title: note.title,
    content: note.content,
    duration: note.duration,
    tags: note.tags || [],
    created_at: note.created_at,
    updated_at: note.updated_at,
    type: 'voice_note',
  };
}

