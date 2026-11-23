/** Mirrors `git check-ref-format --branch` so mistakes are explained before Git rejects them. */
export function branchNameError(name: string) {
  if (!name) return ''
  if (/\s/.test(name)) return '브랜치 이름에는 공백을 쓸 수 없습니다. 하이픈(-)이나 슬래시(/)로 구분하세요.'
  if (/[~^:?*[\\]/.test(name) || [...name].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) return '브랜치 이름에는 ~ ^ : ? * [ \\ 와 제어 문자를 쓸 수 없습니다.'
  if (name.includes('..')) return '마침표 두 개(..)를 연속으로 쓸 수 없습니다.'
  if (name.includes('@{') || name === '@') return '@{ 또는 @ 단독은 브랜치 이름으로 쓸 수 없습니다.'
  if (name.startsWith('-')) return '하이픈(-)으로 시작할 수 없습니다.'
  if (name.startsWith('/') || name.endsWith('/') || name.includes('//')) return '슬래시(/)로 시작·끝나거나 연속으로 쓸 수 없습니다.'
  if (name.endsWith('.') || name.endsWith('.lock') || name.split('/').some(part => part.startsWith('.'))) return '마침표(.)로 시작·끝나거나 .lock으로 끝날 수 없습니다.'
  return ''
}
