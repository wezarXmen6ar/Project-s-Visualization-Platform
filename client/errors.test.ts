// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { translate } from '../shared/i18n/translate';
import { ApiError } from './api';
import { messagesOf, translatorFor } from './errors';

describe('messagesOf', () => {
  it('translates a coded ApiError issue in Arabic', () => {
    const err = new ApiError('Invalid project', 400, [
      { path: 'phases.0.name', message: 'Phase name is required', code: 'validation.phaseNameRequired' },
    ]);
    expect(messagesOf(err, translatorFor('ar'))).toEqual(['اسم المرحلة مطلوب']);
  });

  it('falls back to the server message for an issue with no code', () => {
    const err = new ApiError('Invalid project', 400, [{ path: 'name', message: 'Some server-only text' }]);
    expect(messagesOf(err, translatorFor('ar'))).toEqual(['Some server-only text']);
  });

  it('translates a coded top-level ApiError (no issues) in Arabic', () => {
    const err = new ApiError('Person not found', 404, [], 'error.personNotFound');
    expect(messagesOf(err, translatorFor('ar'))).toEqual(['الشخص غير موجود']);
  });

  it('defaults to English when no translator is given', () => {
    const err = new ApiError('Invalid project', 400, [
      { path: 'phases.0.name', message: 'Phase name is required', code: 'validation.phaseNameRequired' },
    ]);
    expect(messagesOf(err)).toEqual(['Phase name is required']);
  });

  it('joins a reasons list naturally in Arabic', () => {
    const params = { name: 'رامي صالح', reasons: [{ code: 'error.reasonAssignedPhases', count: 3 }, { code: 'error.reasonHasTodos', count: 1 }] };
    const err = new ApiError(
      translate('en', 'error.personInUseDelete', params),
      409,
      [],
      'error.personInUseDelete',
      params,
    );
    const ar = messagesOf(err, translatorFor('ar'))[0];
    expect(ar).toContain('مكلَّف في 3 مراحل');
    expect(ar).toContain('لديه مهمة واحدة');
    expect(ar).toContain(' و');
    const en = messagesOf(err, translatorFor('en'))[0];
    expect(en).toBe("رامي صالح can't be deleted because they are assigned to 3 phases and they have 1 to-do. Make them inactive instead.");
  });

  it('translates a plain (non-ApiError) error as a network error, not its own (browser-specific) message', () => {
    expect(messagesOf(new Error('Failed to fetch'), translatorFor('ar'))).toEqual(['تعذّر الاتصال بخادم التطبيق']);
    expect(messagesOf(new Error('Failed to fetch'))).toEqual(['Could not reach the app server']);
  });

  it('translates a coded requestFailed ApiError (no server message) in Arabic, and keeps English unchanged', () => {
    const err = new ApiError('Request failed (500)', 500, [], 'common.requestFailed', { status: 500 });
    expect(messagesOf(err, translatorFor('ar'))).toEqual(['تعذّر إكمال الطلب (500)']);
    expect(messagesOf(err, translatorFor('en'))).toEqual(['Request failed (500)']);
    expect(messagesOf(err)).toEqual(['Request failed (500)']);
  });

  it('shows the Arabic too-long message, with the field\'s own limit, for a 201-character name', () => {
    const err = new ApiError('Invalid value', 400, [
      { path: 'name', message: 'Keep it under 200 characters', code: 'validation.tooLong', params: { max: 200, count: 200 } },
    ]);
    expect(messagesOf(err, translatorFor('ar'))).toEqual(['يجب ألا يتجاوز النص 200 حرفاً']);
    expect(messagesOf(err, translatorFor('en'))).toEqual(['Keep it under 200 characters']);
  });
});
