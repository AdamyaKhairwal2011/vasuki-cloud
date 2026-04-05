# Email Setup for Login Notifications

This guide will help you set up automatic email notifications when users log in to your Vasuki Cloud application.

## Step 1: Create EmailJS Account

1. Go to [EmailJS](https://www.emailjs.com/)
2. Sign up for a free account
3. Verify your email address

## Step 2: Create Email Service

1. After logging in, click on "Email Services" in the dashboard
2. Click "Add New Service"
3. Choose your email provider (Gmail, Outlook, etc.)
4. Connect your email account by following the authentication steps
5. Note down your **Service ID** (it will look like: `service_xxxxxxxxx`)

## Step 3: Create Email Template

1. Go to "Email Templates" in the dashboard
2. Click "Create New Template"
3. Use the following template settings:

**Template Name:** Login Notification

**Subject:** Login Alert - Vasuki Cloud

**HTML Content:**
```html
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1c1c1e; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔐 Login Notification</h1>
        </div>
        <div class="content">
            <h2>Hello {{user_name}},</h2>
            <p>You have successfully logged into your Vasuki Cloud account.</p>
            
            <div style="background: white; padding: 15px; border-left: 4px solid #1c1c1e; margin: 20px 0;">
                <p><strong>Login Details:</strong></p>
                <p>📧 Email: {{to_email}}</p>
                <p>🕒 Time: {{login_time}}</p>
                <p>💻 Device: {{login_device}}</p>
            </div>
            
            <p>If this was not you, please secure your account immediately.</p>
            <p>Best regards,<br>The Vasuki Cloud Team</p>
        </div>
        <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>
```

**Template Variables:**
- `{{to_email}}` - User's email address
- `{{user_name}}` - User's name
- `{{login_time}}` - Login timestamp
- `{{login_device}}` - Browser/device info

4. Save the template and note down your **Template ID** (it will look like: `template_xxxxxxxxx`)

## Step 4: Get Your Public Key

1. Go to "Account" → "API Keys"
2. Copy your **Public Key** (it will look like: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)

## Step 5: Update login.html

Open `login.html` and replace the placeholder values in the JavaScript section:

```javascript
// Replace these with your actual EmailJS credentials
emailjs.init("YOUR_PUBLIC_KEY"); // Replace with your EmailJS public key
await emailjs.send('YOUR_SERVICE_ID', 'YOUR_TEMPLATE_ID', templateParams);
```

Replace:
- `YOUR_PUBLIC_KEY` with your actual public key
- `YOUR_SERVICE_ID` with your actual service ID  
- `YOUR_TEMPLATE_ID` with your actual template ID

## Step 6: Test the Setup

1. Save the updated login.html file
2. Open your application in a browser
3. Try logging in with valid credentials
4. Check your email (and spam folder) for the login notification

## Important Notes

- The free EmailJS plan allows 200 emails per month
- Emails are sent from your connected email service
- Make sure to keep your API keys secure
- Test thoroughly before deploying to production
- Consider adding rate limiting to prevent email spam

## Troubleshooting

If emails aren't sending:
1. Check browser console for error messages
2. Verify your EmailJS credentials are correct
3. Ensure your email service is properly connected
4. Check that your template variables are correctly named
5. Verify your EmailJS account has available credits

## Alternative Services

If you prefer other email services:
- **Resend** - API-first email service
- **SendGrid** - Professional email delivery
- **Mailgun** - Developer-friendly email service
- **AWS SES** - Amazon's email service (requires AWS account)

These services would require backend implementation as they don't support direct client-side sending like EmailJS.
