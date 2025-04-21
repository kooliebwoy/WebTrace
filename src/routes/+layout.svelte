<script lang="ts">
  	import ThemeSwitcher from '$lib/ui/ThemeSwitcher.svelte';
	import '../app.css';
	
	let { children } = $props();
</script>

<div class="min-h-screen bg-base-200 flex flex-col items-center p-4 sm:p-6">
	<div class="absolute top-0 right-0 flex justify-end p-4 sm:p-6">
		<ThemeSwitcher />
	</div>
    {@render children()}
</div>