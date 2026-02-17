/**
 * Email Module
 * Export all email functionality
 */

export {
  configureEmail,
  getEmailConfig,
  sendEmail,
  createTemplate,
  getTemplate,
  updateTemplate,
  listTemplates,
  addSubscriber,
  unsubscribe,
  getSubscriber,
  listSubscribers,
  createList,
  getList,
  listLists,
  createSequence,
  getSequence,
  createCampaign,
  getCampaign,
  sendCampaign,
  handleWebhook,
  getEmail,
  listEmails,
  setEventBus
} from './service';

export * from './types';
