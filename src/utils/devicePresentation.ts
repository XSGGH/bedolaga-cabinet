/** Presentation only: never write automatic names or aliases back to the API. */
export function devicePresentation(device: {
  device_model?: string | null;
  platform?: string | null;
  local_name?: string | null;
}) {
  const model = /^(unknown|n\/a|undefined|-)$/i.test(device.device_model?.trim() || '')
    ? ''
    : device.device_model?.trim() || '';
  const platform = /^(unknown|n\/a|undefined|-)$/i.test(device.platform?.trim() || '')
    ? ''
    : device.platform?.trim() || '';
  // Identifier mapping verified against DeviceKit's generated device identifiers:
  // https://github.com/devicekit/DeviceKit/blob/master/Source/Device.generated.swift
  const apple: Record<string, string> = {
    'iPhone12,1': 'iPhone 11',
    'iPhone12,3': 'iPhone 11 Pro',
    'iPhone12,5': 'iPhone 11 Pro Max',
  };
  const system =
    apple[model] || model.replace(/\s+(amd64|x86_64|x64|arm64)$/i, '') || platform || 'Устройство';
  const raw = `${model} ${platform}`.toLowerCase();
  const kind = /ipad|tablet/.test(raw)
    ? 'tablet'
    : /iphone|ipod/.test(raw)
      ? 'phone'
      : /android/.test(raw)
        ? 'unknown'
        : /windows|macos|mac os|macbook|linux|ubuntu/.test(raw)
          ? 'computer'
          : 'unknown';
  return { name: device.local_name?.trim() ? device.local_name : system, system, platform, kind };
}
