<script lang="ts">
  import { enhance } from '$app/forms';
  import { fade, fly } from 'svelte/transition';
  import { LockKeyhole, ArrowLeft, Calendar, Shield, Award, AlertTriangle, XCircle, Check, Info, Copy } from '@lucide/svelte';
  import type { ActionData, PageData } from './$types';
  import { goto } from '$app/navigation';
  
  export let data: PageData;
  export let form: ActionData;
  
  let domain = '';
  let isLoading = false;
  let showCopiedToast = false;
  
  $: sslData = form?.certificate;
  $: error = form?.error;
  
  function handleSubmit({ form, data, action, cancel, submitter }) {
    isLoading = true;
    
    return async ({ result, update }) => {
      isLoading = false;
      await update();
    };
  }
  
  function getStatusColor(status) {
    switch (status) {
      case 'valid': return 'success';
      case 'warning': return 'warning';
      case 'expired': return 'error';
      default: return 'base-content';
    }
  }
  
  function getStatusIcon(status) {
    switch (status) {
      case 'valid': return Check;
      case 'warning': return AlertTriangle;
      case 'expired': return XCircle;
      default: return Info;
    }
  }
  
  function getStatusText(status, days) {
    switch (status) {
      case 'valid': return `Valid (expires in ${days} days)`;
      case 'warning': return `Expiring soon (${days} days)`;
      case 'expired': return `Expired ${Math.abs(days)} days ago`;
      default: return 'Unknown';
    }
  }
  
  function copyToClipboard(text) {
    navigator.clipboard.writeText(text);
    showCopiedToast = true;
    setTimeout(() => showCopiedToast = false, 2000);
  }
</script>

<div class="min-h-screen bg-base-200 flex flex-col items-center justify-center p-4 sm:p-6">
  <!-- Container with conditional classes for different layouts -->
  <div class="w-full max-w-[95%] 2xl:max-w-[90%] transition-all duration-500"
      class:flex={!sslData || isLoading}
      class:flex-col={!sslData || isLoading}
      class:items-center={!sslData || isLoading}
      class:justify-center={!sslData || isLoading}
      class:grid={sslData && !isLoading}
      class:grid-cols-1={sslData && !isLoading}
      class:lg:grid-cols-2={sslData && !isLoading}
      class:gap-6={sslData && !isLoading}
      class:lg:gap-10={sslData && !isLoading}>
    
    <!-- Input Card -->
    <div class="card w-[min(350px,95vw)] bg-base-100 shadow-xl transition-all duration-500"
         class:self-start={sslData && !isLoading}
         class:justify-self-center={sslData && !isLoading}
         in:fade={{duration: 300}}>
      
      <!-- Card Header -->
      <div class="bg-success text-success-content p-5">
        <h2 class="text-2xl font-bold flex items-center gap-2">
          <LockKeyhole class="h-6 w-6" />
          SSL Checker
        </h2>
        <p class="text-sm opacity-80 mt-1">Validate SSL certificates for any domain</p>
      </div>
      
      <!-- Card Body -->
      <div class="card-body p-6">
        <form method="post" action="?/sslCheck" class="flex flex-col gap-4" use:enhance={handleSubmit}>
          <div class="form-control">
            <label class="label pb-1">
              <span class="label-text font-medium">Domain name</span>
            </label>
            <div class="relative">
              <input 
                type="text" 
                class="input input-bordered w-full pr-12 font-mono text-sm" 
                name="domain" 
                bind:value={domain} 
                placeholder="example.com" 
                required 
                minlength="4"
                disabled={isLoading} 
              />
              {#if domain}
                <button 
                  type="button" 
                  class="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs btn-circle" 
                  onclick={() => domain = ''}
                  aria-label="Clear input">
                  ✕
                </button>
              {/if}
            </div>
            <label class="label pt-0">
              <span class="label-text-alt">Don't include http:// or https://</span>
            </label>
          </div>
          
          <button 
            class="btn btn-success w-full mt-4 relative overflow-hidden" 
            type="submit" 
            disabled={isLoading}
          >
            {#if isLoading}
              <span class="loading loading-spinner loading-sm absolute"></span>
              <span class="opacity-0">Check SSL</span>
            {:else}
              <Shield class="w-4 h-4 mr-2" />
              Check SSL
            {/if}
          </button>
          
          <div class="mt-2">
            <button 
              type="button" 
              class="btn btn-ghost btn-xs w-full flex justify-center items-center gap-2" 
              onclick={() => goto('/')}
            >
              <ArrowLeft class="w-3 h-3" /> Back to tools
            </button>
          </div>
        </form>
      </div>
    </div>
    
    <!-- Results Card -->
    {#if sslData && !isLoading}
      <div class="card w-full bg-base-100 shadow-xl self-start overflow-hidden" in:fly={{x: 20, duration: 300, delay: 150}}>
        <div class="bg-base-200 p-4 border-b border-base-300">
          <h3 class="text-lg font-semibold flex items-center gap-2">
            <Shield class="w-5 h-5" />
            SSL Certificate for {form.domain}
          </h3>
        </div>
        
        <!-- Status Banner -->
        <div class={`p-4 bg-${getStatusColor(sslData.status)}-soft flex items-center gap-3`}>
          <svelte:component this={getStatusIcon(sslData.status)} class={`w-5 h-5 text-${getStatusColor(sslData.status)}`} />
          <span class="font-medium">{getStatusText(sslData.status, sslData.daysUntilExpiry)}</span>
        </div>
        
        <div class="p-6">
          <!-- Certificate Details -->
          <div class="space-y-5">
            <!-- Basic Information -->
            <div>
              <h4 class="text-sm font-semibold mb-2 text-base-content/70 uppercase">Basic Information</h4>
              <div class="grid gap-4 sm:grid-cols-2">
                <div class="bg-base-200 p-3 rounded-lg">
                  <div class="text-xs text-base-content/60 mb-1">Domain Name</div>
                  <div class="font-mono text-sm break-all">{sslData.subject.CN}</div>
                </div>
                <div class="bg-base-200 p-3 rounded-lg">
                  <div class="text-xs text-base-content/60 mb-1">Issuer</div>
                  <div class="font-mono text-sm break-all">
                    {sslData.issuer.O || sslData.issuer.CN}
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Validity -->
            <div>
              <h4 class="text-sm font-semibold mb-2 text-base-content/70 uppercase">Validity Period</h4>
              <div class="grid gap-4 sm:grid-cols-2">
                <div class="bg-base-200 p-3 rounded-lg flex items-start gap-2">
                  <Calendar class="w-4 h-4 text-base-content/60 mt-0.5" />
                  <div>
                    <div class="text-xs text-base-content/60 mb-1">Valid From</div>
                    <div class="text-sm">{sslData.formattedIssueDate}</div>
                  </div>
                </div>
                <div class="bg-base-200 p-3 rounded-lg flex items-start gap-2">
                  <Calendar class="w-4 h-4 text-base-content/60 mt-0.5" />
                  <div>
                    <div class="text-xs text-base-content/60 mb-1">Valid Until</div>
                    <div class="text-sm">{sslData.formattedExpiryDate}</div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Technical Details -->
            <div>
              <h4 class="text-sm font-semibold mb-2 text-base-content/70 uppercase flex items-center justify-between">
                <span>Technical Details</span>
                <button 
                  class="btn btn-xs btn-ghost normal-case flex gap-1"
                  onclick={() => copyToClipboard(JSON.stringify(sslData, null, 2))}
                >
                  <Copy class="w-3 h-3" />
                  <span class="text-xs">Copy All</span>
                </button>
              </h4>
              
              <div class="space-y-3">
                <!-- Version and Serial -->
                <div class="grid gap-4 sm:grid-cols-2">
                  <div class="bg-base-200 p-3 rounded-lg">
                    <div class="text-xs text-base-content/60 mb-1">Version</div>
                    <div class="font-mono text-sm">v{sslData.version}</div>
                  </div>
                  <div class="bg-base-200 p-3 rounded-lg">
                    <div class="text-xs text-base-content/60 mb-1">Serial Number</div>
                    <div class="font-mono text-sm break-all">{sslData.serialNumber}</div>
                  </div>
                </div>
                
                <!-- Fingerprint -->
                <div class="bg-base-200 p-3 rounded-lg">
                  <div class="text-xs text-base-content/60 mb-1">Fingerprint (SHA-256)</div>
                  <div class="font-mono text-sm break-all">{sslData.fingerprint}</div>
                </div>
              </div>
            </div>
            
            <!-- Alternative Names -->
            {#if sslData.altNames && sslData.altNames.length > 0}
              <div>
                <h4 class="text-sm font-semibold mb-2 text-base-content/70 uppercase">Alternative Domain Names</h4>
                <div class="bg-base-200 p-3 rounded-lg">
                  <div class="flex flex-wrap gap-2">
                    {#each sslData.altNames as name}
                      <div class="badge badge-outline font-mono text-xs p-3">{name}</div>
                    {/each}
                  </div>
                </div>
              </div>
            {/if}
          </div>
        </div>
      </div>
    {:else if error && !isLoading}
      <div class="alert alert-error mt-4 w-full max-w-md" in:fly={{y: 20, duration: 300}}>
        <XCircle class="w-5 h-5" />
        <span>{error}</span>
      </div>
    {/if}
  </div>
</div>

<!-- Toast for copy notification -->
{#if showCopiedToast}
  <div class="toast toast-top toast-center" transition:fade>
    <div class="alert alert-success">
      <Check class="w-4 h-4" />
      <span>Copied to clipboard!</span>
    </div>
  </div>
{/if}
