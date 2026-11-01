"""Patches the generated Capacitor Android project: version numbers and release signing from environment variables.
The signing key itself is never in this repo. CI decodes it from a GitHub Actions secret.
Usage: python3 patch_gradle.py <android dir> <version code> <version name>"""
import re, sys
root, vcode, vname = sys.argv[1], sys.argv[2], sys.argv[3]

def sub1(pattern, repl, s, what):
    s2, n = re.subn(pattern, repl, s, count=1, flags=re.S)
    if not n:
        sys.exit('Could not patch: ' + what)
    return s2

g = root + '/app/build.gradle'
s = open(g).read()
s = sub1(r'versionCode\s+\d+', 'versionCode %d' % int(vcode), s, 'versionCode')
s = sub1(r'versionName\s+"[^"]*"', 'versionName "%s"' % vname, s, 'versionName')
signing = '''signingConfigs {
        release {
            storeFile file(System.getenv('STOWRA_KEYSTORE'))
            storePassword System.getenv('STOWRA_STORE_PASSWORD')
            keyAlias System.getenv('STOWRA_KEY_ALIAS')
            keyPassword System.getenv('STOWRA_KEY_PASSWORD')
        }
    }
    buildTypes {'''
s = sub1(r'buildTypes\s*\{', signing, s, 'buildTypes')
# The release block that belongs to buildTypes (the signingConfigs block above also has a "release")
head, tail = s.split('buildTypes {', 1)
tail = sub1(r'(release\s*\{)', r'\1\n            signingConfig signingConfigs.release', tail, 'release block')
s = head + 'buildTypes {' + tail
open(g, 'w').write(s)

# Keep target SDK 34 for now so the layout is not forced edge to edge. Revisit before any Play Store release.
v = root + '/variables.gradle'
t = open(v).read()
t = sub1(r'targetSdkVersion\s*=\s*\d+', 'targetSdkVersion = 34', t, 'targetSdkVersion')
open(v, 'w').write(t)
print('patched android project in', root)
