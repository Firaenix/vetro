using System;

namespace Launcher.Core
{
    /// <summary>
    /// Makes an icon read from Samsung's own app registry look like the rest of the dock: rounded
    /// corners, and a dark glass tile behind logos that ship on a transparent background. Works on
    /// EFL's pixel layout (premultiplied ARGB, one uint per pixel) so it runs on a desktop in the tests.
    /// </summary>
    internal static class IconPrep
    {
        public const int MaxSide = 256;
        public const int MinSide = 32;

        /// <summary>Below this share of opaque pixels an icon is a loose logo, not a filled tile.</summary>
        public const float LooseCoverage = 0.8f;
        /// <summary>How much of the tile a loose logo may fill.</summary>
        public const float LooseScale = 0.72f;

        public static float Coverage(uint[] px)
        {
            if (px.Length == 0) return 0f;
            int opaque = 0;
            for (int i = 0; i < px.Length; i++) if ((px[i] >> 24) > 200) opaque++;
            return opaque / (float)px.Length;
        }

        /// <summary>Corner radius in pixels, the squircle look of the other tiles (29 at 128).</summary>
        public static int Corner(int side) { return (int)Math.Round(29.0 * side / 128.0); }

        /// <summary>The square the finished icon will have for a w x h source.</summary>
        public static int SideFor(int w, int h)
        {
            return Math.Max(MinSide, Math.Min(MaxSide, Math.Max(w, h)));
        }

        /// <summary>Returns the finished icon: <paramref name="side"/> x <paramref name="side"/> pixels.</summary>
        public static uint[] Prepare(uint[] src, int w, int h)
        {
            if (w <= 0 || h <= 0 || src == null || src.Length < w * h) throw new ArgumentException("bad icon size");
            int side = SideFor(w, h);
            uint[] outPx;
            bool square = w == h;
            if (square && Coverage(src) >= LooseCoverage)
                outPx = square && w == side ? (uint[])src.Clone() : Scale(src, w, h, side, side);
            else
            {
                outPx = Tile(side);
                // Fit the whole logo inside the smaller box: never crop it.
                int box = (int)(side * LooseScale);
                int gw = w >= h ? box : Math.Max(1, (int)Math.Round(box * (double)w / h));
                int gh = h >= w ? box : Math.Max(1, (int)Math.Round(box * (double)h / w));
                uint[] glyph = Scale(src, w, h, gw, gh);
                Over(outPx, side, glyph, gw, gh, (side - gw) / 2, (side - gh) / 2);
            }
            RoundCorners(outPx, side, Corner(side));
            return outPx;
        }

        /// <summary>Dark glass tile with a faint rim, the colour of the dock's own system tiles.</summary>
        public static uint[] Tile(int side)
        {
            var px = new uint[side * side];
            for (int y = 0; y < side; y++)
            {
                float t = y / (float)(side - 1);
                int r = (int)(44 - 24 * t), g = (int)(54 - 28 * t), b = (int)(82 - 38 * t);
                for (int x = 0; x < side; x++)
                {
                    int rr = r, gg = g, bb = b;
                    if (x == 0 || y == 0 || x == side - 1 || y == side - 1)   // 1 px rim, white at ~25%
                    {
                        rr += (255 - rr) / 4; gg += (255 - gg) / 4; bb += (255 - bb) / 4;
                    }
                    px[y * side + x] = 0xFF000000u | ((uint)rr << 16) | ((uint)gg << 8) | (uint)bb;
                }
            }
            return px;
        }

        /// <summary>Multiplies every pixel by an anti-aliased rounded-square mask.</summary>
        public static void RoundCorners(uint[] px, int side, int radius)
        {
            if (radius <= 0) return;
            for (int y = 0; y < radius; y++)
                for (int x = 0; x < radius; x++)
                {
                    // Distance of the pixel centre from the corner circle's centre, in pixels.
                    double dx = radius - (x + 0.5), dy = radius - (y + 0.5);
                    double d = Math.Sqrt(dx * dx + dy * dy);
                    double cov = Math.Max(0.0, Math.Min(1.0, radius - d + 0.5));
                    if (cov >= 1.0) continue;
                    int m = (int)Math.Round(cov * 256);
                    Mask(px, y * side + x, m);
                    Mask(px, y * side + (side - 1 - x), m);
                    Mask(px, (side - 1 - y) * side + x, m);
                    Mask(px, (side - 1 - y) * side + (side - 1 - x), m);
                }
        }

        private static void Mask(uint[] px, int i, int m256)
        {
            uint p = px[i];
            uint a = ((p >> 24) * (uint)m256) >> 8, r = (((p >> 16) & 0xFF) * (uint)m256) >> 8,
                 g = (((p >> 8) & 0xFF) * (uint)m256) >> 8, b = ((p & 0xFF) * (uint)m256) >> 8;
            px[i] = (a << 24) | (r << 16) | (g << 8) | b;
        }

        /// <summary>Composites a premultiplied glyph over a premultiplied base.</summary>
        public static void Over(uint[] dst, int dw, uint[] glyph, int gw, int gh, int ox, int oy)
        {
            for (int y = 0; y < gh; y++)
                for (int x = 0; x < gw; x++)
                {
                    uint s = glyph[y * gw + x];
                    uint sa = s >> 24;
                    if (sa == 0) continue;
                    int di = (y + oy) * dw + (x + ox);
                    uint d = dst[di];
                    uint inv = 255 - sa;
                    uint a = sa + ((d >> 24) * inv + 127) / 255;
                    uint r = ((s >> 16) & 0xFF) + (((d >> 16) & 0xFF) * inv + 127) / 255;
                    uint g = ((s >> 8) & 0xFF) + (((d >> 8) & 0xFF) * inv + 127) / 255;
                    uint b = (s & 0xFF) + ((d & 0xFF) * inv + 127) / 255;
                    dst[di] = (Math.Min(a, 255u) << 24) | (Math.Min(r, 255u) << 16) | (Math.Min(g, 255u) << 8) | Math.Min(b, 255u);
                }
        }

        /// <summary>Bilinear resize of premultiplied ARGB, with edge clamping.</summary>
        public static uint[] Scale(uint[] src, int w, int h, int dw, int dh)
        {
            var dst = new uint[dw * dh];
            double sx = w / (double)dw, sy = h / (double)dh;
            for (int y = 0; y < dh; y++)
            {
                double fy = (y + 0.5) * sy - 0.5;
                int y0 = (int)Math.Floor(fy);
                double wy = fy - y0;
                int ya = Math.Max(0, Math.Min(h - 1, y0)), yb = Math.Max(0, Math.Min(h - 1, y0 + 1));
                for (int x = 0; x < dw; x++)
                {
                    double fx = (x + 0.5) * sx - 0.5;
                    int x0 = (int)Math.Floor(fx);
                    double wx = fx - x0;
                    int xa = Math.Max(0, Math.Min(w - 1, x0)), xb = Math.Max(0, Math.Min(w - 1, x0 + 1));
                    uint p00 = src[ya * w + xa], p10 = src[ya * w + xb], p01 = src[yb * w + xa], p11 = src[yb * w + xb];
                    uint res = 0;
                    for (int shift = 0; shift <= 24; shift += 8)
                    {
                        double top = ((p00 >> shift) & 0xFF) * (1 - wx) + ((p10 >> shift) & 0xFF) * wx;
                        double bot = ((p01 >> shift) & 0xFF) * (1 - wx) + ((p11 >> shift) & 0xFF) * wx;
                        res |= (uint)Math.Round(top * (1 - wy) + bot * wy) << shift;
                    }
                    dst[y * dw + x] = res;
                }
            }
            return dst;
        }
    }
}
