# StudyBox

Your Space. Your Focus. Your Success.

A responsive student study project demonstrating university study-pod discovery and booking. Built with HTML, CSS, JavaScript and GSAP ScrollTrigger. No package installation or build step is needed.

## Publish with GitHub Pages

1. Create a GitHub repository.
2. Extract `StudyBox-GitHub.zip` and upload all its contents to the repository root, preserving the `assets` folder. The root should contain:

```text
index.html
styles.css
app.js
assets/
.nojekyll
README.md
```

3. Commit the files to the `main` branch.
4. In the repository, open **Settings → Pages**.
5. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
6. Choose **main** and **/ (root)**, then click **Save**.
7. When deployment completes, open the website URL shown on the Pages settings screen.

Official instructions: [Configure a GitHub Pages publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

To upload through GitHub's web interface, choose **Add file → Upload files** and drag the extracted files and `assets` folder into the upload area. Keep `index.html` at the top level of the repository.

## Demo functionality

The site includes a campus finder with Google Maps, interactive pricing, date/time and pod selection, simulated availability, QR passes, simulated unlocking, local booking persistence, cancellation and calendar downloads. The Google Maps embed needs an internet connection. All other assets are included locally.

Bookings are saved only in the browser used to create them. There is no server database, account system, email service, payment processor or connection to physical locks.

## Study project disclaimer

StudyBox is a student study project created solely for educational and demonstration purposes. It is a fictional startup concept and is not a live commercial service. No real pods can be reserved or unlocked, and no payments are processed. University names and map locations illustrate the concept; no affiliation, endorsement or partnership is implied. Product visuals, pod installations, availability and prices are illustrative.

The website displays a short disclaimer in the footer, with the full notice under **Study project disclaimer & privacy**. It does not appear on the main screen.

## Editing

- `index.html`: page content, footer disclaimer and information dialogs.
- `styles.css`: typography, colours, layouts and responsive styles.
- `app.js`: campus data, booking behavior, pricing, QR passes and animation.
- `assets/`: fonts, artwork, scripts and third-party license notices.

Manrope is distributed under the SIL Open Font License. QRCode.js is distributed under the MIT license. The corresponding license files are included in `assets/`. GSAP and ScrollTrigger retain their license notices in their script headers. The cabin concept render was generated from a supplied product reference.
