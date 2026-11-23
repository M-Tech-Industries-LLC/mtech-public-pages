"""Offline content, route, accessibility-structure and theme-integrity checks.

Run from any directory with Python 3. No network or package installation.
"""
import hashlib
import json
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
EXPECTED = {
    'afterglow-86': 'Afterglow ’86', 'ember': 'Ember', 'ice': 'Ice',
    'nebula': 'Nebula', 'reading-room': 'Reading Room', 'smoke': 'Smoke',
    'terrene': 'Terrene', 'tidal': 'Tidal', 'zephyr': 'Zephyr',
}
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}


class Page(HTMLParser):
    def __init__(self, path):
        super().__init__(convert_charrefs=True)
        self.path, self.refs, self.ids, self.tags = path, [], set(), []
        self.stack, self.errors, self.theme_ids = [], [], []
        self.feed(path.read_text())
        assert not self.stack, (path, 'unclosed elements', self.stack)
        assert not self.errors, (path, self.errors)

    def handle_starttag(self, tag, pairs):
        attrs = dict(pairs)
        self.tags.append((tag, attrs))
        if attrs.get('id'):
            assert attrs['id'] not in self.ids, (self.path, 'duplicate id', attrs['id'])
            self.ids.add(attrs['id'])
        if attrs.get('data-theme-id'):
            self.theme_ids.append(attrs['data-theme-id'])
        for key in ('href', 'src', 'data-data-path'):
            if attrs.get(key):
                self.refs.append(attrs[key])
        if attrs.get('http-equiv', '').lower() == 'refresh':
            self.refs.append(attrs['content'].split('url=', 1)[1])
        if tag == 'img':
            assert attrs.get('alt'), (self.path, 'image missing meaningful alt')
            assert attrs.get('width') and attrs.get('height'), (self.path, 'image dimensions missing')
        if tag not in VOID:
            self.stack.append(tag)

    def handle_endtag(self, tag):
        if not self.stack or self.stack.pop() != tag:
            self.errors.append('unbalanced closing tag: ' + tag)


pages = {p: Page(p) for p in sorted(ROOT.rglob('*.html')) if '.git' not in p.parts}
refs = 0
external = set()
for path, page in pages.items():
    assert any(t == 'html' and a.get('lang') == 'en' for t, a in page.tags), path
    assert any(t == 'meta' and a.get('name') == 'viewport' for t, a in page.tags), path
    assert sum(t == 'h1' for t, _ in page.tags) == 1, path
    assert sum(t == 'main' for t, _ in page.tags) == 1, path
    for ref in page.refs:
        u = urlsplit(ref)
        if u.scheme in ('https', 'mailto'):
            external.add(ref)
            continue
        assert not u.scheme and not u.netloc, (path, 'unexpected URL', ref)
        target = (ROOT / unquote(u.path).lstrip('/') if u.path.startswith('/') else path.parent / unquote(u.path)).resolve() if u.path else path
        assert target.is_relative_to(ROOT), (path, ref, 'outside website')
        if target.is_dir():
            target /= 'index.html'
        assert target.is_file(), (path.relative_to(ROOT), ref, 'missing resource')
        if u.fragment and target in pages:
            assert unquote(u.fragment) in pages[target].ids, (path, ref, 'missing anchor')
        refs += 1

product = json.loads((ROOT / 'assets/data/patch-notes.json').read_text())['products']['afon']
for link in product['testing']['links']:
    assert urlsplit(link['url']).scheme == 'https'
    external.add(link['url'])
assert product['releases'][0]['version'] == '0.1.3+29'
assert product['releases'][0]['releaseDate'] == 'Android — November 19, 2026; iOS / iPadOS — availability date not independently verified'
assert product['releases'][0]['websitePublicationDate'] == 'Not published — Owner approval pending'
assert len(product['releases'][0]['knownIssues']) == 3
for path in ['index.html', 'afon.html', 'support.html', 'testing/afon/index.html', 'patch-notes/afon/index.html', 'known-issues/afon/index.html']:
    assert '0.1.3+29' in (ROOT / path).read_text(), path
assert [r['buildNumber'] for r in product['releases'][1:]] == [
    '28', '27', '26', '25', '24', '23', '22', '20', '17', '16', '15',
    '14', '13', '12', '11', '10', '8', '7', '6', '5', '4'
]
assert len({r['version'] for r in product['releases']}) == len(product['releases'])
assert not any('Current Android Open Testing' in r.get('testingStatus', '') or 'latest recorded iOS' in r.get('testingStatus', '') for r in product['releases'])

testing_hub = (ROOT / 'testing/index.html').read_text()
assert 'Afon Mobile' in testing_hub
assert 'Senta' not in testing_hub and 'Ironveil' not in testing_hub
for name, status in [('senta', 'internal operational tool'), ('ironveil', 'development is on hold')]:
    text = (ROOT / f'testing/{name}/index.html').read_text().lower()
    assert status in text, name
    assert 'no public enrollment' in text, name
    assert 'data-release-app' not in text, name

gallery = pages[ROOT / 'afon/themes/index.html']
assert gallery.theme_ids == list(EXPECTED), gallery.theme_ids
for theme_id in ('nebula', 'smoke'):
    assert any(tag == 'img' and attrs.get('src') == f'../../themes/afon/{theme_id}/background.webp'
               and 'background artwork' in attrs.get('alt', '') for tag, attrs in gallery.tags), theme_id
for name in EXPECTED.values():
    assert name in gallery.path.read_text(), name
registry = json.loads((ROOT / 'themes/afon/registry.json').read_text())
assert {t['themeId'] for t in registry['themes']} == set(EXPECTED)
for theme in registry['themes']:
    theme_id = theme['themeId']
    folder = ROOT / 'themes/afon' / theme_id
    package = folder / 'package.zip'
    expected_hash = (folder / 'package.sha256').read_text().split()[0]
    assert hashlib.sha256(package.read_bytes()).hexdigest() == expected_hash, theme_id
    manifest = json.loads((folder / 'manifest.json').read_text())
    assert manifest['themeId'] == theme_id and manifest['publisherId'] == 'mtech'
    assert manifest['behaviorScope'] == 'cosmetic_only'
    assert manifest['allowsCodeExecution'] is False and manifest['allowsWebViewModification'] is False
    assert (folder / manifest['assets']['preview']).is_file()
    with ZipFile(package) as z:
        assert z.testzip() is None, theme_id
        assert all(not n.startswith('/') and '..' not in Path(n).parts for n in z.namelist()), theme_id
        assert json.loads(z.read('manifest.json')) == manifest, theme_id
        for asset in manifest['assets'].values():
            assert z.read(asset) == (folder / asset).read_bytes(), (theme_id, asset)
    assert theme['packageUrl'] == f'https://m-techindustries.com/themes/afon/{theme_id}/package.zip'
    assert theme['sha256Url'] == f'https://m-techindustries.com/themes/afon/{theme_id}/package.sha256'

print(json.dumps({'result': 'PASS', 'htmlPages': len(pages), 'internalReferences': refs,
                  'externalReferences': sorted(external), 'themes': len(EXPECTED),
                  'coverage': 'Static HTML balance, route/fragment/asset existence, basic accessibility structure, current-version labels, gallery inventory and ZIP/hash/manifest integrity. Browser rendering and live resources require separate checks.'}, indent=2))
