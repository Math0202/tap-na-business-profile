import { ref } from 'vue'

export const legalRequestOpen = ref(false)
export const legalRequestKind = ref('privacy')

export function openLegalRequest(kind) {
  legalRequestKind.value = kind === 'terms' ? 'terms' : 'privacy'
  legalRequestOpen.value = true
}

export function closeLegalRequest() {
  legalRequestOpen.value = false
}
