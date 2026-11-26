import type { ComponentType } from 'react';
import { getComponentType } from '../lib/maintenance';
import { ChainIcon, CableIcon, DerailleurIcon, CassetteIcon, DrivetrainIcon, BrakePadsIcon, TireIcon, BottomBracketIcon, HeadsetIcon, WheelIcon, SaddleIcon, GearedHubIcon, BatteryIcon, BrakeDiscIcon, ForkIcon, ShockIcon, GenericComponentIcon } from '../icons';

export const maintenanceComponentIcons: Record<string, ComponentType> = {
  chain: ChainIcon,
  cables: CableIcon,
  'jockey-wheels': DerailleurIcon,
  cassette: CassetteIcon,
  chainrings: DrivetrainIcon,
  'brake-pads': BrakePadsIcon,
  tire: TireIcon,
  'bottom-bracket': BottomBracketIcon,
  headset: HeadsetIcon,
  wheel: WheelIcon,
  saddle: SaddleIcon,
  'geared-hub': GearedHubIcon,
  battery: BatteryIcon,
  'brake-disc': BrakeDiscIcon,
  fork: ForkIcon,
  shock: ShockIcon,
  component: GenericComponentIcon,
};

export function MaintenanceComponentIcon({ name }: { name: string }) {
  const icon = getComponentType(name).icon;
  const Icon = maintenanceComponentIcons[icon] ?? GenericComponentIcon;
  return <span className="maintenance-type-icon" data-component-icon={icon} aria-hidden="true"><Icon /></span>;
}
