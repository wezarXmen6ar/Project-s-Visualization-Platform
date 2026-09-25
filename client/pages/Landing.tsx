import { Link } from 'react-router';
import { useT } from '../i18n/LanguageProvider';
import { ArrowRightIcon, KanbanIcon, PresentationIcon } from '../icons';

export function Landing() {
  const t = useT();
  return (
    <main className="landing">
      <div>
        <h1>{t('landing.title')}</h1>
        <p className="landing-sub">{t('landing.subtitle')}</p>
      </div>
      <div className="landing-tiles">
        <Link to="/manage" className="tile">
          <span className="tile-icon"><KanbanIcon /></span>
          <h2>{t('landing.manage')}</h2>
          <p>{t('landing.manageDescription')}</p>
          <span className="tile-arrow"><ArrowRightIcon /></span>
        </Link>
        <Link to="/present" className="tile">
          <span className="tile-icon"><PresentationIcon /></span>
          <h2>{t('landing.present')}</h2>
          <p>{t('landing.presentDescription')}</p>
          <span className="tile-arrow"><ArrowRightIcon /></span>
        </Link>
      </div>
    </main>
  );
}
