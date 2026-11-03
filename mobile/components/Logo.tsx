import { Image } from 'react-native';

type LogoProps = {
  size?: number;
  color?: string;
};

export function Logo({ size = 40, color = '#C5D200' }: LogoProps) {
  return (
    <Image
      source={require('@/assets/images/Logo.png')}
      style={{ width: size, height: size, tintColor: color }}
      resizeMode="contain"
    />
  );
}
