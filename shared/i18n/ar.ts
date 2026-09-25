import type { MessageKey } from './en';
import type { Message } from './types';

/**
 * The Arabic catalogue. Every word follows the approved glossary (docs/superpowers/glossary-ar.md): natural
 * Modern Standard Arabic, buttons as verbal nouns, Western digits.
 */
export const ar: Record<MessageKey, Message> = {
  'common.save': 'حفظ',
  'common.cancel': 'إلغاء',
  'common.edit': 'تعديل',
  'common.delete': 'حذف',
  'common.remove': 'إزالة',
  'common.add': 'إضافة',
  'common.next': 'التالي',
  'common.back': 'السابق',
  'common.loading': 'جارٍ التحميل…',
  'common.none': 'لا يوجد',
  'common.notSet': 'غير محدد',

  'lang.switch': 'اللغة',
  'lang.ar': 'العربية',
  'lang.en': 'English',

  'landing.title': 'محفظة المشاريع',
  'landing.subtitle': 'اختر ما تريد القيام به.',
  'landing.manage': 'إدارة المشاريع',
  'landing.manageDescription': 'أنشئ المشاريع وأدِر مراحلها والأشخاص المكلَّفين بها.',
  'landing.present': 'عرض المشاريع',
  'landing.presentDescription': 'اعرض محفظة المشاريع على الجهات المعنية.',

  'notFound.title': 'الصفحة غير موجودة',
  'notFound.body': 'هذه الصفحة غير متوفرة حالياً.',
  'notFound.back': 'العودة إلى البداية',
};
