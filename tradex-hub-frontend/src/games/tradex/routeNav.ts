import type { NavigateFunction } from 'react-router-dom';

let _navigate: NavigateFunction | null = null;
let _playerId: number | null = null;

export function setRouteNav(navigate: NavigateFunction, playerId: number | null) {
  _navigate = navigate;
  _playerId = playerId;
}

export function getRouteNavigate() {
  return { navigate: _navigate, playerId: _playerId };
}
