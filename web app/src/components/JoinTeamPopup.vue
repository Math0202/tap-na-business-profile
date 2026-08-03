<script setup>
import { computed, ref, watch } from 'vue'
import { personalTypeLabel } from '../lib/teamRoles'
import { apiUpdateTeamMember } from '../lib/api'

const props = defineProps({
  open: { type: Boolean, default: false },
  invite: { type: Object, default: null }
})
const emit = defineEmits(['close', 'done'])

const roleLabel = computed(() => personalTypeLabel(props.invite?.role || 'professional'))
const submitting = ref(false)
const error = ref('')

watch(() => props.open, (v) => {
  if (v) {
    error.value = ''
    submitting.value = false
  }
})

async function respond(action) {
  if (!props.invite?.memberId || submitting.value) return
  submitting.value = true
  error.value = ''
  try {
    const res = await apiUpdateTeamMember(props.invite.memberId, { action })
    if (!res.ok) {
      error.value = res.error || 'Could not update invite'
      return
    }
    emit('done', { action, invite: props.invite })
    emit('close')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open && invite" class="app-dialog-overlay fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/70" />
      <div class="relative w-full max-w-md card-item-bg rounded-3xl p-5 shadow-2xl">
        <h2 class="text-lg font-bold">Join team?</h2>
        <p class="text-sm text-gray-400 mt-2 leading-relaxed">
          <strong class="text-gray-200">{{ invite.ownerName || 'A team owner' }}</strong>
          invited you to join
          <strong class="text-gray-200">{{ invite.teamName || 'their team' }}</strong>
          as <strong class="text-gray-200">{{ roleLabel }}</strong>.
        </p>
        <p class="text-xs text-amber-300/90 mt-3">
          If you accept, you cannot leave the team yourself later. Only a team manager can remove you.
        </p>
        <p v-if="error" class="text-sm text-red-300 mt-3">{{ error }}</p>
        <div class="flex gap-2 mt-5">
          <button
            type="button"
            class="flex-1 py-3 rounded-full bg-zinc-800 text-sm font-semibold disabled:opacity-50"
            :disabled="submitting"
            @click="respond('reject')"
          >
            Reject
          </button>
          <button
            type="button"
            class="flex-1 py-3 rounded-full bg-white text-black text-sm font-bold disabled:opacity-50"
            :disabled="submitting"
            @click="respond('accept')"
          >
            {{ submitting ? 'Saving…' : 'Accept' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
