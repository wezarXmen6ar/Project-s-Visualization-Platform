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

  it('handles a plain (non-ApiError) error', () => {
    expect(messagesOf(new Error('boom'), translatorFor('ar'))).toEqual(['boom']);
  });
});
