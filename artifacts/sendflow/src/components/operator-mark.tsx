import { useEffect, useState } from 'react';

type OperatorMarkData = {
  id?: string;
  operatorId?: string;
  initials: string;
  logoUrl: string | null;
  shortName?: string;
  name?: string;
};

export function OperatorMark({
  operator,
  imageClassName,
  fallbackClassName,
}: {
  operator: OperatorMarkData;
  imageClassName?: string;
  fallbackClassName?: string;
}) {
  const [logoFailed, setLogoFailed] = useState(false);
  const id = operator.id ?? operator.operatorId ?? 'operator';

  useEffect(() => {
    setLogoFailed(false);
  }, [operator.logoUrl]);

  if (operator.logoUrl && !logoFailed) {
    return (
      <img
        src={operator.logoUrl}
        alt=""
        className={imageClassName}
        loading="lazy"
        referrerPolicy="no-referrer"
        data-testid={`img-operator-logo-${id}`}
        onError={() => setLogoFailed(true)}
      />
    );
  }

  return (
    <strong className={fallbackClassName} data-testid={`text-operator-initials-${id}`}>
      {operator.initials || operator.shortName?.slice(0, 4) || operator.name?.slice(0, 4) || 'OP'}
    </strong>
  );
}
