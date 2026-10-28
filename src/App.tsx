import { AskAll } from './components/AskAll';
import { Library } from './components/Library';
import { Live } from './components/Live';
import { MeetingView } from './components/MeetingView';
import { SettingsPage } from './components/SettingsPage';
import { Upload } from './components/Upload';
import { hasKey } from './lib/ai';
import { useRoute, useStore } from './lib/store';

const NAV = [
  ['', '🏠', 'Meetings'],
  ['live', '●', 'Live'],
  ['upload', '⬆', 'Upload'],
  ['ask', '💬', 'Ask'],
  ['settings', '⚙', 'Settings'],
] as const;

export function App() {
  const route = useRoute();
  const { settings } = useStore();
  const [page, id, flag] = route;
  const isLive = page === 'live';

  let view;
  switch (page) {
    case 'live':
      view = <Live />;
      break;
    case 'm':
      view = <MeetingView key={id} id={id} autoNotes={flag === 'new'} />;
      break;
    case 'settings':
      view = <SettingsPage />;
      break;
    case 'upload':
      view = <Upload />;
      break;
    case 'ask':
      view = <AskAll />;
      break;
    default:
      view = <Library />;
  }

  return (
    <div className={`app ${isLive ? 'is-live' : ''}`}>
      <nav className="topnav">
        <a href="#/" className="brand">
          <span className="logo">◉</span> Meeter
        </a>
        <div className="navlinks">
          {NAV.map(([path, icon, label]) => (
            <a key={label} href={`#/${path}`} className={(page ?? '') === path ? 'on' : ''}>
              <span>{icon}</span>
              <span className="lbl">{label}</span>
              {path === 'settings' && !hasKey(settings) && <i className="dot" />}
            </a>
          ))}
        </div>
      </nav>
      <main>{view}</main>
    </div>
  );
}
