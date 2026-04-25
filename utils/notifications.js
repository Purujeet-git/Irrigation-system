import nodemailer from 'nodemailer';
import webpush from 'web-push';
import dotenv from 'dotenv';
dotenv.config();

webpush.setVapidDetails(
    'mailto:admin@irrigationhub.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

// Mock ESP Command "Sender" (In a real scenario, this could hit an IP or MQTT)
export const sendESPCommand = async (fieldName, command) => {
    console.log(`[ESP8266] Sending command "${command}" to field: ${fieldName}`);
    // Here you would add code to hit your ESP's local IP or an MQTT broker
    return true;
};

// Email Sender
export const sendIrrigationEmail = async (userEmail, userName, fieldName) => {
    try {
        // NOTE: In production, use your real SMTP credentials
        let transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
                user: 'demo@ethereal.email', // replace with real credentials
                pass: 'demo_password'
            }
        });

        const mailOptions = {
            from: '"Smart Irrigation System" <system@irrigation.com>',
            to: userEmail,
            subject: `🚨 Irrigation Due: ${fieldName}`,
            text: `Hello ${userName},\n\nYour field "${fieldName}" is due for irrigation. We have sent the "ON" command to your ESP device.\n\nPlease check your dashboard for details.\n\nBest regards,\nSmart Irrigation Team`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #3b82f6;">🚨 Irrigation Due: ${fieldName}</h2>
                    <p>Hello <strong>${userName}</strong>,</p>
                    <p>Your field "<strong>${fieldName}</strong>" is due for irrigation (24 hours have passed since the last update).</p>
                    <div style="background: #f0fdf4; padding: 10px; border-radius: 5px; border-left: 4px solid #22c55e;">
                        <strong>Action Taken:</strong> "ON" command has been sent to your ESP device.
                    </div>
                    <p>Please check your dashboard to monitor the progress.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="font-size: 0.8rem; color: #666;">This is an automated notification from your Smart Irrigation System.</p>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`[Email] Notification sent to ${userEmail}: ${info.messageId}`);
        return true;
    } catch (err) {
        console.error("[Email Error] Failed to send email:", err);
        return false;
    }
};

// Web Push Notification
export const sendPushNotification = async (subscription, title, body) => {
    if (!subscription) return;
    try {
        const payload = JSON.stringify({ title, body });
        await webpush.sendNotification(subscription, payload);
        console.log(`[Push] Notification sent: ${title}`);
    } catch (err) {
        console.error("[Push Error] Failed to send push:", err);
    }
};
