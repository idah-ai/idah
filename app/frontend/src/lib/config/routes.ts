import type { RouteId } from "$app/types";

interface RouteConfig {
	id: string;
	label: string;
}

interface RouteConfigs {
	[key: string]: RouteConfig;
}

export const routeConfig: RouteConfigs = {
	home: {
		id: "/(app)",
		label: "Home",
	},
	project: {
		id: "/(app)/projects",
		label: "Projects",
	},
};

export function getRouteConfigById(routeId: RouteId | null): RouteConfig | undefined {
	if (!routeId) return undefined;

	return Object.values(routeConfig).find((route) => route.id === routeId);
}
