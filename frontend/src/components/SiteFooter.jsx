import { Link } from 'react-router-dom'
import { FacebookIcon, InstagramIcon } from './Icons'

// The footer from squarerootssmu.ca (Enactus, contact, social), with Partner Portal links added.
// `inPortal` adds "Partner Portal" to the copyright line inside the portal.
export default function SiteFooter({ inPortal = false }) {
  return (
    <>
      <footer className="public-footer">
        <div className="public-footer-inner">
          <div className="footer-enactus">
            <img src="/logos/enactus-smu.png" alt="Enactus Saint Mary's University" />
            <p>
              <a href="mailto:info@enactussmu.ca">info@enactussmu.ca</a>
            </p>
            <a
              className="footer-website-button"
              href="https://arthurlirvingentrepreneurshipcentre.ca/for-students/enactus-saint-marys/"
              target="_blank"
              rel="noreferrer"
            >
              Website
            </a>
          </div>

          <div className="footer-contact">
            <h3>Contact Us</h3>
            <p>
              <a href="mailto:squareroots@enactussmu.ca">squareroots@enactussmu.ca</a>
            </p>
            <p>
              5907 Gorsebrook Ave, Halifax
              <br />
              NS B3H 1G3
            </p>
            <h3 className="footer-portal-heading">Partner Portal</h3>
            <p>
              <Link to="/portal/login">Log in</Link> · <Link to="/signup">Sign up</Link>
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
        <Link to="/privacy">Privacy</Link>
      </div>
    </>
  )
}
