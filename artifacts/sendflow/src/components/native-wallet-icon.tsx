import nativeWalletIcon from '@assets/10149443_1789713972148.png';

type NativeWalletIconProps = {
  className?: string;
};

export function NativeWalletIcon({ className = '' }: NativeWalletIconProps) {
  return (
    <span
      className={`sendflow-native-wallet-icon${className ? ` ${className}` : ''}`}
      aria-hidden="true"
      style={{ backgroundImage: `url("${nativeWalletIcon}")` }}
      onContextMenu={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
    />
  );
}