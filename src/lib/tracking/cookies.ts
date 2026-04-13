export function getFBCookies(): { fbc: string | null; fbp: string | null } {
  if (typeof document === "undefined") return { fbc: null, fbp: null };

  const cookies = document.cookie.split(";").reduce(
    (acc, cookie) => {
      const [key, value] = cookie.trim().split("=");
      acc[key] = value;
      return acc;
    },
    {} as Record<string, string>
  );

  return {
    fbc: cookies["_fbc"] || null,
    fbp: cookies["_fbp"] || null,
  };
}

export function buildFBC(fbclid: string | null): string | null {
  if (!fbclid) return null;
  const timestamp = Date.now();
  return `fb.1.${timestamp}.${fbclid}`;
}

export function getOrBuildFBC(fbclid: string | null): string | null {
  const { fbc } = getFBCookies();
  if (fbc) return fbc;
  return buildFBC(fbclid);
}
