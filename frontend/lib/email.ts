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
    timeZone: 'UTC',
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

// Feature 0 — admin notification when a client makes a new booking
export async function notifyAdminNewBooking({
  adminEmails,
  orgName,
  clientName,
  sessionName,
  startTime,
}: {
  adminEmails: string[]
  orgName: string
  clientName: string
  sessionName: string
  startTime: Date
}) {
  if (adminEmails.length === 0) return

  const subject = `[${orgName}] New booking by ${clientName}`

  const html = baseLayout(
    orgName,
    `
    <h2 style="margin-top:0;color:#8B1538">New Booking</h2>
    <p><strong>${clientName}</strong> just booked a session:</p>
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
    `
  )

  await sendEmail(adminEmails, subject, html)
}

// Feature 0b — confirmation email to the client after booking
export async function sendBookingConfirmation({
  clientEmail,
  clientName,
  orgName,
  sessionName,
  startTime,
  endTime,
}: {
  clientEmail: string
  clientName: string
  orgName: string
  sessionName: string
  startTime: Date
  endTime: Date
}) {
  const subject = `Booking confirmed — ${sessionName}`

  const html = baseLayout(
    orgName,
    `
    <h2 style="margin-top:0;color:#8B1538">Booking Confirmed!</h2>
    <p>Hi <strong>${clientName}</strong>, your booking is confirmed:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr style="background:#f9fafb">
        <td style="padding:10px 12px;font-weight:600;border:1px solid #e5e7eb;width:35%">Session</td>
        <td style="padding:10px 12px;border:1px solid #e5e7eb">${sessionName}</td>
      </tr>
      <tr>
        <td style="padding:10px 12px;font-weight:600;border:1px solid #e5e7eb">Date &amp; Time</td>
        <td style="padding:10px 12px;border:1px solid #e5e7eb">${formatDateTime(startTime)}</td>
      </tr>
      <tr style="background:#f9fafb">
        <td style="padding:10px 12px;font-weight:600;border:1px solid #e5e7eb">End Time</td>
        <td style="padding:10px 12px;border:1px solid #e5e7eb">${formatDateTime(endTime)}</td>
      </tr>
    </table>
    <p style="color:#6b7280;font-size:14px">If you need to cancel or reschedule, please do so through the app.</p>
    `
  )

  await sendEmail(clientEmail, subject, html)
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

// Feature 1b — confirmation email to the client when they cancel their own booking
export async function notifyClientCancellation({
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
  const subject = `Booking cancelled — ${sessionName}`

  const html = baseLayout(
    orgName,
    `
    <h2 style="margin-top:0;color:#8B1538">Booking Cancelled</h2>
    <p>Hi <strong>${clientName}</strong>, your booking has been cancelled:</p>
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
    <p style="color:#6b7280;font-size:14px">If this was a mistake, you can rebook through the app.</p>
    `
  )

  await sendEmail(clientEmail, subject, html)
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

// Feature 5 — notify client when admin cancels their booking
export async function notifyClientAdminCancellation({
  clientEmail,
  clientName,
  orgName,
  sessionName,
  startTime,
  reason,
}: {
  clientEmail: string
  clientName: string
  orgName: string
  sessionName: string
  startTime: Date
  reason?: string | null
}) {
  const subject = `Your booking was cancelled — ${sessionName}`

  const html = baseLayout(
    orgName,
    `
    <h2 style="margin-top:0;color:#8B1538">Booking Cancelled by Studio</h2>
    <p>Hi <strong>${clientName}</strong>, your booking has been cancelled by ${orgName}:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr style="background:#f9fafb">
        <td style="padding:10px 12px;font-weight:600;border:1px solid #e5e7eb;width:35%">Session</td>
        <td style="padding:10px 12px;border:1px solid #e5e7eb">${sessionName}</td>
      </tr>
      <tr>
        <td style="padding:10px 12px;font-weight:600;border:1px solid #e5e7eb">Date &amp; Time</td>
        <td style="padding:10px 12px;border:1px solid #e5e7eb">${formatDateTime(startTime)}</td>
      </tr>
      ${reason ? `<tr style="background:#f9fafb"><td style="padding:10px 12px;font-weight:600;border:1px solid #e5e7eb">Reason</td><td style="padding:10px 12px;border:1px solid #e5e7eb">${reason}</td></tr>` : ''}
    </table>
    <p style="color:#6b7280;font-size:14px">If you have questions, please contact ${orgName} directly.</p>
    `
  )

  await sendEmail(clientEmail, subject, html)
}

// Feature 6 — notify client when admin renews their membership
export async function sendMembershipRenewedEmail({
  clientEmail,
  clientName,
  orgName,
  sessionsAdded,
  newAllowance,
}: {
  clientEmail: string
  clientName: string
  orgName: string
  sessionsAdded: number
  newAllowance: number
}) {
  const subject = `Your ${orgName} membership has been renewed`

  const html = baseLayout(
    orgName,
    `
    <h2 style="margin-top:0;color:#8B1538">Membership Renewed</h2>
    <p>Hi <strong>${clientName}</strong>, your membership at ${orgName} has been topped up:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr style="background:#f9fafb">
        <td style="padding:10px 12px;font-weight:600;border:1px solid #e5e7eb;width:50%">Sessions added</td>
        <td style="padding:10px 12px;border:1px solid #e5e7eb">${sessionsAdded}</td>
      </tr>
      <tr>
        <td style="padding:10px 12px;font-weight:600;border:1px solid #e5e7eb">Sessions now available</td>
        <td style="padding:10px 12px;border:1px solid #e5e7eb">${newAllowance}</td>
      </tr>
    </table>
    <p>You can now book your next sessions through the app.</p>
    `
  )

  await sendEmail(clientEmail, subject, html)
}

// Feature 7 — warn client they used a pending slot (owed on next renewal)
export async function sendPendingSlotWarning({
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
  const subject = `Booking confirmed — 1 session owed on next renewal`

  const html = baseLayout(
    orgName,
    `
    <h2 style="margin-top:0;color:#8B1538">Booking Confirmed (Pending Slot)</h2>
    <p>Hi <strong>${clientName}</strong>, your booking is confirmed. You had no remaining sessions in your membership, so this session will be deducted from your <strong>next renewal</strong>:</p>
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
    <p style="color:#6b7280;font-size:14px">Contact ${orgName} if you have questions about your membership balance.</p>
    `
  )

  await sendEmail(clientEmail, subject, html)
}

// Feature 7b — alert admins when a client books using a pending slot
export async function notifyAdminPendingSlotUsed({
  adminEmails,
  orgName,
  clientName,
  sessionName,
  startTime,
}: {
  adminEmails: string[]
  orgName: string
  clientName: string
  sessionName: string
  startTime: Date
}) {
  if (adminEmails.length === 0) return

  const subject = `[${orgName}] Pending slot used by ${clientName}`

  const html = baseLayout(
    orgName,
    `
    <h2 style="margin-top:0;color:#8B1538">Pending Slot Used</h2>
    <p><strong>${clientName}</strong> booked a session with no remaining allowance. This slot will be owed on their next renewal:</p>
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
    <p style="color:#6b7280;font-size:14px">Remember to deduct 1 session from their next renewal.</p>
    `
  )

  await sendEmail(adminEmails, subject, html)
}

// Feature 8 — confirm to client that they joined the interest list
export async function sendInterestListConfirmation({
  clientEmail,
  clientName,
  orgName,
  sessionName,
  date,
  startTime,
  endTime,
}: {
  clientEmail: string
  clientName: string
  orgName: string
  sessionName: string
  date: string
  startTime: string
  endTime: string
}) {
  const subject = `You're on the waitlist — ${sessionName}`

  const html = baseLayout(
    orgName,
    `
    <h2 style="margin-top:0;color:#8B1538">You're on the Waitlist</h2>
    <p>Hi <strong>${clientName}</strong>, you've been added to the interest list for:</p>
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
    <p style="color:#6b7280;font-size:14px">We'll notify you as soon as a spot becomes available. Spots are first-come, first-served.</p>
    `
  )

  await sendEmail(clientEmail, subject, html)
}

// Feature 8b — notify admins when a client joins the interest list
export async function notifyAdminInterestEntry({
  adminEmails,
  orgName,
  clientName,
  sessionName,
  date,
  startTime,
  endTime,
}: {
  adminEmails: string[]
  orgName: string
  clientName: string
  sessionName: string
  date: string
  startTime: string
  endTime: string
}) {
  if (adminEmails.length === 0) return

  const subject = `[${orgName}] ${clientName} joined the waitlist`

  const html = baseLayout(
    orgName,
    `
    <h2 style="margin-top:0;color:#8B1538">New Waitlist Entry</h2>
    <p><strong>${clientName}</strong> joined the interest list for a full session:</p>
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
    `
  )

  await sendEmail(adminEmails, subject, html)
}

// Feature 9 — password reset email
export async function sendPasswordResetEmail({
  email,
  name,
  resetUrl,
}: {
  email: string
  name: string
  resetUrl: string
}) {
  const subject = 'Reset your Spacyy password'

  const html = baseLayout(
    'Spacyy',
    `
    <h2 style="margin-top:0;color:#8B1538">Password Reset</h2>
    <p>Hi <strong>${name || 'there'}</strong>,</p>
    <p>We received a request to reset your Spacyy password. Click the button below to set a new one:</p>
    <a href="${resetUrl}"
       style="display:inline-block;background:#8B1538;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0">
      Reset Password
    </a>
    <p style="color:#6b7280;font-size:14px;margin-top:16px">This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
    `
  )

  await sendEmail(email, subject, html)
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
