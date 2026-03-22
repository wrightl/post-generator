export async function sendPostPublished(
  toEmail: string,
  platform: string,
  postPreview: string
): Promise<boolean> {
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  const fromAddress = process.env.MAILGUN_FROM_ADDRESS;
  const fromName = process.env.MAILGUN_FROM_NAME ?? "Post Generator";

  if (!apiKey || !domain) return false;

  const auth = Buffer.from(`api:${apiKey}`).toString("base64");
  const form = new URLSearchParams({
    from: `${fromName} <${fromAddress}>`,
    to: toEmail,
    subject: `Your post was published on ${platform}`,
    text: `Your scheduled post was published on ${platform}.\n\nPreview:\n${postPreview}`,
  });

  const res = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  return res.ok;
}
