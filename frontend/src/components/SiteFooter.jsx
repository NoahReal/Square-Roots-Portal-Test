import { Link } from 'react-router-dom'
import { useLanguage, wordsFor } from '../i18n'
import { FacebookIcon, InstagramIcon } from './Icons'

// The footer from squarerootssmu.ca (Enactus, contact, social), with Partner Portal links added.
// `inPortal` adds "Partner Portal" to the copyright line inside the portal.
export default function SiteFooter({ inPortal = false }) {
  // The portal is English only
  const { t: chosen } = useLanguage()
  const t = inPortal ? wordsFor('en') : chosen
  return (
    <>
      <footer className="public-footer">
        <div className="public-footer-inner">
          <div className="footer-enactus">
            <img src="/logos/enactus-smu.png" alt={t.footer.enactusAlt} />
            <p>
              <a href="mailto:info@enactussmu.ca">info@enactussmu.ca</a>
            </p>
            <a
              className="footer-website-button"
              href="https://arthurlirvingentrepreneurshipcentre.ca/for-students/enactus-saint-marys/"
              target="_blank"
              rel="noreferrer"
            >
              {t.footer.website}
            </a>
          </div>

          <div className="footer-contact">
            <h3>{t.footer.contactUs}</h3>
            <p>
              <a href="mailto:squareroots@enactussmu.ca">squareroots@enactussmu.ca</a>
            </p>
            <p>
              5907 Gorsebrook Ave, Halifax
              <br />
              NS B3H 1G3
            </p>
            <h3 className="footer-portal-heading">{t.footer.partnerPortal}</h3>
            <p>
              <Link to="/portal/login">{t.common.logIn}</Link> · <Link to="/signup">{t.common.signUp}</Link>
            </p>
          </div>

          <div className="footer-social">
            <a href="https://www.instagram.com/squarerootssmu" target="_blank" rel="noreferrer">
              <InstagramIcon size={28} /> Instagram
            </a>
            <a href="https://www.facebook.com/SquareRootsSMU/" target="_blank" rel="noreferrer">
              <FacebookIcon size={28} /> Facebook
            </a>
          </div>
        </div>
      </footer>
      <div className="copyright">
        © {new Date().getFullYear()} Square Roots C.I.C.{inPortal && ' · Partner Portal'} ·{' '}
        <Link to="/privacy">{t.common.privacy}</Link>
      </div>
    </>
  )
}
