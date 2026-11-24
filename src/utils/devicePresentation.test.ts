import { expect, it } from 'vitest';
import { devicePresentation } from './devicePresentation';
it('keeps the user alias and uses the system platform for the icon', () => {
  const device = {
    local_name: 'Мой iPhone',
    device_model: 'Windows 10 amd64',
    platform: 'Windows',
  };
  expect(devicePresentation(device)).toMatchObject({
    name: 'Мой iPhone',
    system: 'Windows 10',
    kind: 'computer',
  });
  expect(device.device_model).toBe('Windows 10 amd64');
});
it('recognizes verified Apple model identifiers', () =>
  expect(devicePresentation({ device_model: 'iPhone12,1', platform: 'iOS' })).toMatchObject({
    name: 'iPhone 11',
    kind: 'phone',
  }));
it('distinguishes tablets from phones', () =>
  expect(devicePresentation({ device_model: 'iPad', platform: 'iOS' }).kind).toBe('tablet'));
it('does not guess a phone based on Android alone', () =>
  expect(devicePresentation({ platform: 'Android' }).kind).toBe('unknown'));
it('does not infer the type from an alias', () =>
  expect(devicePresentation({ local_name: 'Мой ПК', platform: 'Unknown' }).kind).toBe('unknown'));
