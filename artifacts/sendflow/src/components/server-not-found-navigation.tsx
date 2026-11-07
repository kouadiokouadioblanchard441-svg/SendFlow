import { useEffect } from 'react';
import { useLocation } from 'wouter';

const SERVER_404_RELOAD_MARKER = '__sendflow_server_404_reload__';

export default function ServerNotFoundNavigation() {
  const [path] = useLocation();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const currentState = window.history.state;
    if (
      currentState
      && typeof currentState === 'object'
      && currentState[SERVER_404_RELOAD_MARKER] === true
    ) {
      return;
    }

    const nextState = currentState && typeof currentState === 'object'
      ? { ...currentState, [SERVER_404_RELOAD_MARKER]: true }
      : { [SERVER_404_RELOAD_MARKER]: true };

    window.history.replaceState(nextState, '', window.location.href);
    window.location.reload();
  }, [path]);

  return null;
}
