/**
 * Instagram webhook controller — replaces the stub in webhook.controller.js
 * Paste these handlers into webhook.controller.js to enable full Instagram DM support.
 */
const { parseInstagramWebhook, sendInstagramMessage, getInstagramUserName } = require('../services/channels/instagram.service');
const { handleInboundMessage } = require('./webhook.controller'); // re-use shared pipeline
const Clinic = require('../models/Clinic.model');
const logger = require('../utils/logger');

exports.instagramVerify = (req, res) => {
  const { webhookSecret } = require('../config/env');
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === webhookSecret) {
    logger.info('Instagram webhook verified');
    return res.status(200).send(challenge);
  }
  return res.status(403).send('Forbidden');
};

exports.instagramWebhook = async (req, res) => {
  // Always respond 200 fast — Facebook will retry if you don't
  res.status(200).send('EVENT_RECEIVED');

  try {
    const parsed = parseInstagramWebhook(req.body);
    if (!parsed || !parsed.messageText) return;

    const clinic   = req.clinic;
    const clinicId = clinic._id.toString();

    // Optionally fetch the sender's display name on first message
    const pageAccessToken = process.env[`IG_PAGE_TOKEN_${clinicId}`] || process.env.IG_PAGE_ACCESS_TOKEN;
    const senderName = await getInstagramUserName(parsed.senderId, pageAccessToken);

    const { aiOutput } = await handleInboundMessage({
      clinicId,
      clinic,
      channel:       'instagram',
      channelUserId: parsed.senderId,
      phone:         null,  // Instagram doesn't expose phone numbers
      name:          senderName,
      userMessage:   parsed.messageText,
      metadata:      { messageId: parsed.messageId, igsid: parsed.senderId },
    });

    // Reply via Instagram DM
    if (pageAccessToken) {
      await sendInstagramMessage(parsed.senderId, aiOutput.reply, pageAccessToken);
    }
  } catch (err) {
    logger.error('Instagram webhook processing error', { err: err.message });
  }
};
