// Same footer as squarerootssmu.ca: green columns, then the yellow copyright bar.
export default function Footer() {
  return (
    <>
      <footer className="site-footer">
        <div className="container footer-cols">
          <div>
            <h3>Square Roots</h3>
            <p>Seconds produce across Nova Scotia. Food-secure communities.</p>
          </div>
          <div>
            <h3>Enactus Saint Mary's</h3>
            <p>Run by students at Saint Mary's University, Halifax.</p>
          </div>
          <div>
            <h3>Contact Us</h3>
            <p>
              <a href="mailto:squareroots@enactussmu.ca">squareroots@enactussmu.ca</a>
            </p>
          </div>
        </div>
      </footer>
      <div className="copyright">© {new Date().getFullYear()} Square Roots C.I.C. · Partner portal prototype</div>
    </>
  )
}
