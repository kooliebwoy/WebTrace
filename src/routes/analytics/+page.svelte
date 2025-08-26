<script lang="ts">
	import { LucideActivity, LucideTerminal, LucideAlertTriangle, LucideGlobe } from '@lucide/svelte';
	
	type PageMeta = { title: string; description: string };
	const data: PageMeta = {
		title: 'Analytics Dashboard',
		description: 'View and analyze server logs'
	};
</script>

<svelte:head>
	<title>{data.title}</title>
	<meta name="description" content={data.description} />
</svelte:head>

<div class="container mx-auto p-4">
	<h1 class="text-3xl font-bold mb-6">{data.title}</h1>
	<p class="mb-4 text-lg">{data.description}</p>

	<!-- Analytics Tools Grid -->
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
		<div class="card bg-base-200 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 h-full">
			<div class="card-body">
				<div class="card-title flex justify-start">
					<LucideAlertTriangle class="w-5 h-5 text-warning mr-2" />
					Error Logs
				</div>
				<p class="py-2">
					View and analyze server error logs. Track PHP errors, warnings, and notices to
					identify and troubleshoot issues on your server.
				</p>
				<div class="card-actions justify-end mt-4">
					<a href="/analytics/error" class="btn btn-primary btn-sm">
						View Error Logs
					</a>
				</div>
			</div>
		</div>
		
		<div class="card bg-base-200 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 h-full">
			<div class="card-body">
				<div class="card-title flex justify-start">
					<LucideGlobe class="w-5 h-5 text-info mr-2" />
					Access Logs
				</div>
				<p class="py-2">
					Monitor website traffic and user activity with access logs. View HTTP requests,
					IP addresses, response times, and user agents to understand site usage patterns.
				</p>
				<div class="card-actions justify-end mt-4">
					<a href="/analytics/access" class="btn btn-primary btn-sm">
						View Access Logs
					</a>
				</div>
			</div>
		</div>

		<div class="card bg-base-200 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 h-full">
			<div class="card-body">
				<div class="card-title flex justify-start">
					<LucideActivity class="w-5 h-5 text-success mr-2" />
					Log Analysis
				</div>
				<p class="py-2">
					Advanced log analysis tools to identify trends, spot anomalies, and generate
					insightful reports from your server logs (coming soon).
				</p>
				<div class="card-actions justify-end mt-4">
					<button class="btn btn-disabled btn-sm">
						Coming Soon
					</button>
				</div>
			</div>
		</div>
	</div>
</div>