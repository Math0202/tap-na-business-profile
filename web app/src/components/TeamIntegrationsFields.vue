<script setup>
import { MEETING_TOOLS, CRM_PROVIDERS } from '../lib/teamIntegrations'

defineProps({
  meetingTool: { type: String, default: '' },
  usesCrm: { type: Boolean, default: false },
  crmProvider: { type: String, default: '' },
  crmOther: { type: String, default: '' },
  disabled: { type: Boolean, default: false }
})

const emit = defineEmits(['update:meetingTool', 'update:usesCrm', 'update:crmProvider', 'update:crmOther'])
</script>

<template>
  <div class="space-y-4 text-left">
    <div>
      <p class="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
        Meeting calendar
      </p>
      <p class="text-[12px] text-gray-500 mb-2 leading-snug">
        Choose Google Meet or Microsoft. Guests get that button on booking emails.
      </p>
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="tool in MEETING_TOOLS"
          :key="tool.id"
          type="button"
          class="flex items-center gap-2 rounded-2xl border px-3 py-3 text-left transition-colors"
          :class="
            meetingTool === tool.id
              ? 'border-white bg-white/10 text-white'
              : 'border-zinc-700 bg-zinc-900/50 text-gray-300 hover:border-zinc-500'
          "
          :disabled="disabled"
          @click="emit('update:meetingTool', tool.id)"
        >
          <img :src="tool.logo" :alt="tool.label" class="w-7 h-7 object-contain shrink-0" width="28" height="28">
          <span class="text-sm font-semibold">{{ tool.label }}</span>
        </button>
      </div>
    </div>

    <label class="flex items-start gap-3 cursor-pointer">
      <input
        :checked="usesCrm"
        type="checkbox"
        class="mt-1 rounded border-zinc-600"
        :disabled="disabled"
        @change="emit('update:usesCrm', $event.target.checked)"
      >
      <span class="min-w-0">
        <span class="block text-sm font-semibold">We use CRM</span>
        <span class="block text-[12px] text-gray-500 mt-0.5 leading-snug">
          Add a CRM button on your meeting emails so you can save the guest as a lead.
        </span>
      </span>
    </label>

    <div v-if="usesCrm" class="space-y-2">
      <p class="block text-xs font-semibold uppercase tracking-wide text-gray-400">
        Which CRM?
      </p>
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="crm in CRM_PROVIDERS"
          :key="crm.id"
          type="button"
          class="flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-left transition-colors"
          :class="
            crmProvider === crm.id
              ? 'border-white bg-white/10 text-white'
              : 'border-zinc-700 bg-zinc-900/50 text-gray-300 hover:border-zinc-500'
          "
          :disabled="disabled"
          @click="emit('update:crmProvider', crm.id)"
        >
          <img :src="crm.logo" :alt="crm.label" class="w-7 h-7 object-contain shrink-0" width="28" height="28">
          <span class="text-sm font-semibold">{{ crm.label }}</span>
        </button>
      </div>
      <div v-if="crmProvider === 'other'">
        <label class="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5" for="crm-other">
          CRM name
        </label>
        <input
          id="crm-other"
          :value="crmOther"
          type="text"
          class="field-input w-full"
          placeholder="e.g. Custom CRM"
          maxlength="80"
          :disabled="disabled"
          @input="emit('update:crmOther', $event.target.value)"
        >
      </div>
    </div>
  </div>
</template>
