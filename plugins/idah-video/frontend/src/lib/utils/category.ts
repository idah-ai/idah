export function isCategoryMatch(annotationCategory: string | undefined, targetCategory: string): boolean {
  if (!annotationCategory) {
    return false;
  }

  return annotationCategory === targetCategory || annotationCategory.startsWith(`${targetCategory}/`);
}
