import nodemailer from 'nodemailer'

const createTransporter = () =>
  nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  })

export async function sendEmail(to: string | string[], subject: string, html: string) {
  const transporter = createTransporter()
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: Array.isArray(to) ? to.join(', ') : to,
    subject,
    html,
  })
}

function formatDateTime(date: Date) {
  return date.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function baseLayout(orgName: string, content: string) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#111827">
      <div style="background:#8B1538;padding:20px 24px;border-radius:8px 8px 0 0">
        <h1 style="margin:0;color:#fff;font-size:20px">${orgName}</h1>
      </div>
      <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
        ${content}
      </div>
      <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:16px">
        Powered by Spacyy
      </p>
    </div>
  `
}

// Feature 1 — admin notification when client cancels or reschedules
export async function notifyAdminCancellation({
  adminEmails,
  orgName,
  clientName,
  sessionName,
  startTime,
  isReschedule,
}: {
  adminEmails: string[]
  orgName: string
  clientName: string
  sessionName: string
  startTime: Date
  isReschedule: boolean
}) {
  if (adminEmails.length === 0) return

  const action = isReschedule ? 'rescheduled' : 'cancelled'
  const subject = `[${orgName}] Booking ${action} by ${clientName}`

  const html = baseLayout(
    orgName,
    `
    <h2 style="margin-top:0;color:#8B1538">Booking ${action}</h2>
    <p><strong>${clientName}</strong> has ${action} their booking:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr style="background:#f9fafb">
        <td style="padding:10px 12px;font-weight:600;border:1px solid #e5e7eb;width:35%">Session</td>
        <td style="padding:10px 12px;border:1px solid #e5e7eb">${sessionName}</td>
      </tr>
      <tr>
        <td style="padding:10px 12px;font-weight:600;border:1px solid #e5e7eb">Date &amp; Time</td>
        <td style="padding:10px 12px;border:1px solid #e5e7eb">${formatDateTime(startTime)}</td>
      </tr>
    </table>
    ${isReschedule ? '<p style="color:#6b7280;font-size:14px">The client may be rebooking for a different time.</p>' : ''}
    `
  )

  await sendEmail(adminEmails, subject, html)
}

// Feature 2 — renewal reminder sent 24h before the client's last session
export async function sendRenewalReminder({
  clientEmail,
  clientName,
  orgName,
  sessionName,
  startTime,
}: {
  clientEmail: string
  clientName: string
  orgName: string
  sessionName: string
  startTime: Date
}) {
  const subject = `Renew your ${orgName} membership — last session tomorrow`

  const html = baseLayout(
    orgName,
    `
    <h2 style="margin-top:0;color:#8B1538">Your membership is almost up</h2>
    <p>Hi <strong>${clientName}</strong>,</p>
    <p>Your upcoming session is the last one covered by your current membership:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr style="background:#f9fafb">
        <td style="padding:10px 12px;font-weight:600;border:1px solid #e5e7eb;width:35%">Session</td>
        <td style="padding:10px 12px;border:1px solid #e5e7eb">${sessionName}</td>
      </tr>
      <tr>
        <td style="padding:10px 12px;font-weight:600;border:1px solid #e5e7eb">Date &amp; Time</td>
        <td style="padding:10px 12px;border:1px solid #e5e7eb">${formatDateTime(startTime)}</td>
      </tr>
    </table>
    <p>Contact ${orgName} to renew your membership so you can keep booking sessions.</p>
    `
  )

  await sendEmail(clientEmail, subject, html)
}

// Feature 3 — welcome email sent when admin creates a client account
export async function sendWelcomeEmail({
  clientEmail,
  clientName,
  orgName,
  loginUrl,
  tempPassword,
}: {
  clientEmail: string
  clientName: string
  orgName: string
  loginUrl: string
  tempPassword: string
}) {
  const subject = `Welcome to ${orgName} — your account is ready`

  const html = baseLayout(
    orgName,
    `
    <h2 style="margin-top:0;color:#8B1538">Welcome, ${clientName}!</h2>
    <p>Your account has been created for <strong>${orgName}</strong>. You can now log in and start booking sessions.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr style="background:#f9fafb">
        <td style="padding:10px 12px;font-weight:600;border:1px solid #e5e7eb;width:35%">Email</td>
        <td style="padding:10px 12px;border:1px solid #e5e7eb">${clientEmail}</td>
      </tr>
      <tr>
        <td style="padding:10px 12px;font-weight:600;border:1px solid #e5e7eb">Temporary password</td>
        <td style="padding:10px 12px;border:1px solid #e5e7eb;font-family:monospace;font-size:16px;letter-spacing:2px">${tempPassword}</td>
      </tr>
    </table>
    <p>You will be asked to set a new password on your first login.</p>
    <a href="${loginUrl}"
       style="display:inline-block;background:#8B1538;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin-top:8px">
      Log In Now
    </a>
    `
  )

  await sendEmail(clientEmail, subject, html)
}

// Feature 4 — notify interested clients that a spot opened up
export async function sendSpotAvailableNotification({
  clientEmail,
  clientName,
  orgName,
  sessionName,
  date,
  startTime,
  endTime,
  bookingUrl,
}: {
  clientEmail: string
  clientName: string
  orgName: string
  sessionName: string
  date: string
  startTime: string
  endTime: string
  bookingUrl: string
}) {
  const subject = `A spot opened up — ${sessionName} on ${date}`

  const html = baseLayout(
    orgName,
    `
    <h2 style="margin-top:0;color:#8B1538">A spot is available!</h2>
    <p>Hi <strong>${clientName}</strong>,</p>
    <p>A spot has opened up for a session you were interested in:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr style="background:#f9fafb">
        <td style="padding:10px 12px;font-weight:600;border:1px solid #e5e7eb;width:35%">Session</td>
        <td style="padding:10px 12px;border:1px solid #e5e7eb">${sessionName}</td>
      </tr>
      <tr>
        <td style="padding:10px 12px;font-weight:600;border:1px solid #e5e7eb">Date</td>
        <td style="padding:10px 12px;border:1px solid #e5e7eb">${date}</td>
      </tr>
      <tr style="background:#f9fafb">
        <td style="padding:10px 12px;font-weight:600;border:1px solid #e5e7eb">Time</td>
        <td style="padding:10px 12px;border:1px solid #e5e7eb">${startTime} – ${endTime}</td>
      </tr>
    </table>
    <p>Book your spot now before it fills up again:</p>
    <a href="${bookingUrl}"
       style="display:inline-block;background:#8B1538;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin-top:8px">
      Book Now
    </a>
    <p style="color:#9ca3af;font-size:12px;margin-top:24px">
      Spots are first-come, first-served. This notification was also sent to other interested clients.
    </p>
    `
  )

  await sendEmail(clientEmail, subject, html)
}
