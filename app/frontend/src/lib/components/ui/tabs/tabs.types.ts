export interface BaseTabsItem<Value> {
	label: string;
	value: Value;
}

export type BaseTabs<Value> = BaseTabsItem<Value>[];
