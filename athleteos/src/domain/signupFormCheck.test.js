import { describe, expect, it } from 'vitest';
import { signupFormProblem } from '../../supabase/functions/_shared/signupFormCheck.ts';
describe('contrôle anti-bot du formulaire', () => {
  it('ne compare pas deux horloges pour un nouveau client', () => {
    for (const formLoadedAt of [100, 9999999999999]) expect(signupFormProblem({ company: '', formElapsedMs: 1500, formLoadedAt }, 10000)).toBeNull();
  });
  it('conserve le honeypot même avec une durée suffisante', () => {
    expect(signupFormProblem({ company: 'Bot', formElapsedMs: 3000 })).toBe('form_verification_failed');
  });
  it('refuse les soumissions rapides sans fallback sur un ancien timestamp', () => {
    expect(signupFormProblem({ formElapsedMs: 1499, formLoadedAt: 1 }, 10000)).toBe('form_too_fast');
  });
  it.each([null, '3000', -1, NaN, Infinity])('refuse une durée invalide (%s)', formElapsedMs => {
    expect(signupFormProblem({ formElapsedMs, formLoadedAt: 1 }, 10000)).toBe('form_timing_invalid');
  });
  it('reste compatible avec les anciens clients sans accepter une date absente ou future', () => {
    expect(signupFormProblem({ formLoadedAt: 8000 }, 10000)).toBeNull();
    expect(signupFormProblem({ formLoadedAt: 9000 }, 10000)).toBe('form_too_fast');
    for (const formLoadedAt of [undefined, null, '8000', 0, 11000]) expect(signupFormProblem({ formLoadedAt }, 10000)).toBe('form_timing_invalid');
  });
});
