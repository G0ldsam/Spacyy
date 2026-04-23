import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { sendEmail } from '@/lib/email'

const contactSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address').transform(v => v.toLowerCase().trim()),
  phone: z.string().optional(),
  businessName: z.string().min(1, 'Business name is required'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const validated = contactSchema.parse(body)

    // For now, we'll log the contact form submission
    // Later, you can integrate with an email service (SendGrid, Resend, etc.)
    console.log('Contact Form Submission:', {
      name: validated.name,
      email: validated.email,
      phone: validated.phone,
      businessName: validated.businessName,
      message: validated.message,
      timestamp: new Date().toISOString(),
    })

    // TODO: Send email to vagosxristof@gmail.com
    // For now, we'll use a simple approach with nodemailer or a service like Resend

    // Simulate email sending (replace with actual email service)
    try {
      await sendContactEmail(validated)
    } catch (emailError) {
      console.error('Email sending failed:', emailError)
      // Still return success to user even if email fails
      // You can monitor logs for email issues
    }

    return NextResponse.json(
      { success: true, message: 'Contact form submitted successfully' },
      { status: 200 }
    )
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error processing contact form:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function sendContactEmail(data: {
  name: string
  email: string
  phone?: string
  businessName: string
  message: string
}) {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#8B1538">New Contact Form Submission</h2>
      <p>A new inquiry has been submitted from spacyy.com</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0">
        <tr style="background:#f3f4f6">
          <td style="padding:12px;font-weight:bold;border:1px solid #e5e7eb;width:35%">Name</td>
          <td style="padding:12px;border:1px solid #e5e7eb">${data.name}</td>
        </tr>
        <tr>
          <td style="padding:12px;font-weight:bold;border:1px solid #e5e7eb">Email</td>
          <td style="padding:12px;border:1px solid #e5e7eb"><a href="mailto:${data.email}">${data.email}</a></td>
        </tr>
        <tr style="background:#f3f4f6">
          <td style="padding:12px;font-weight:bold;border:1px solid #e5e7eb">Phone</td>
          <td style="padding:12px;border:1px solid #e5e7eb">${data.phone || 'Not provided'}</td>
        </tr>
        <tr>
          <td style="padding:12px;font-weight:bold;border:1px solid #e5e7eb">Business</td>
          <td style="padding:12px;border:1px solid #e5e7eb">${data.businessName}</td>
        </tr>
      </table>
      <div style="background:#f9fafb;padding:16px;border-left:4px solid #8B1538;margin:20px 0">
        <h3 style="margin-top:0">Message:</h3>
        <p style="white-space:pre-wrap">${data.message}</p>
      </div>
      <p style="color:#6b7280;font-size:12px">Submitted at: ${new Date().toLocaleString()}</p>
    </div>
  `

  await sendEmail(
    process.env.SMTP_USER || '',
    `New Contact: ${data.businessName} — ${data.name}`,
    html
  )
}
