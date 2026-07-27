export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      accounting_sync_log: {
        Row: {
          error_message: string | null
          external_ref: string | null
          id: string
          order_id: string
          provider: string
          status: string
          synced_at: string
          tenant_id: string
        }
        Insert: {
          error_message?: string | null
          external_ref?: string | null
          id?: string
          order_id: string
          provider: string
          status: string
          synced_at?: string
          tenant_id: string
        }
        Update: {
          error_message?: string | null
          external_ref?: string | null
          id?: string
          order_id?: string
          provider?: string
          status?: string
          synced_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_sync_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_sync_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          body: string
          created_at: string
          ends_at: string | null
          id: string
          is_active: boolean
          starts_at: string
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          starts_at?: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          starts_at?: string
          title?: string
        }
        Relationships: []
      }
      anomaly_alerts: {
        Row: {
          acknowledged_at: string | null
          branch_id: string
          business_date: string
          created_at: string
          id: string
          message: string
          tenant_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          branch_id: string
          business_date: string
          created_at?: string
          id?: string
          message: string
          tenant_id: string
        }
        Update: {
          acknowledged_at?: string | null
          branch_id?: string
          business_date?: string
          created_at?: string
          id?: string
          message?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "anomaly_alerts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anomaly_alerts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "effective_menu_items"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "anomaly_alerts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_keys_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_product_overrides: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          is_available: boolean
          is_sold_out: boolean | null
          price_minor: number | null
          product_id: string
          stock_quantity: number | null
          tenant_id: string
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          is_available?: boolean
          is_sold_out?: boolean | null
          price_minor?: number | null
          product_id: string
          stock_quantity?: number | null
          tenant_id: string
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          is_available?: boolean
          is_sold_out?: boolean | null
          price_minor?: number | null
          product_id?: string
          stock_quantity?: number | null
          tenant_id?: string
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branch_product_overrides_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_product_overrides_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "effective_menu_items"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "branch_product_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "effective_menu_items"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "branch_product_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_product_overrides_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_product_overrides_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "effective_menu_items"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "branch_product_overrides_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      call_types: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          is_system: boolean
          key: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          is_system?: boolean
          key: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          is_system?: boolean
          key?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_types_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string
          ends_at: string | null
          id: string
          is_active: boolean
          name: string
          rule_config: Json
          rule_type: string
          starts_at: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          rule_config?: Json
          rule_type: string
          starts_at?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          rule_config?: Json
          rule_type?: string
          starts_at?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_movements: {
        Row: {
          amount_minor: number
          branch_id: string
          cash_shift_id: string
          created_at: string
          created_by: string | null
          id: string
          movement_type: string
          note: string | null
          tenant_id: string
        }
        Insert: {
          amount_minor: number
          branch_id: string
          cash_shift_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type: string
          note?: string | null
          tenant_id: string
        }
        Update: {
          amount_minor?: number
          branch_id?: string
          cash_shift_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type?: string
          note?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "effective_menu_items"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "cash_movements_cash_shift_id_fkey"
            columns: ["cash_shift_id"]
            isOneToOne: false
            referencedRelation: "cash_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_shifts: {
        Row: {
          branch_id: string
          closed_at: string | null
          closed_by: string | null
          counted_cash_minor: number | null
          created_at: string
          expected_cash_minor: number | null
          id: string
          opened_at: string
          opened_by: string
          opening_balance_minor: number
          status: string
          tenant_id: string
          variance_minor: number | null
        }
        Insert: {
          branch_id: string
          closed_at?: string | null
          closed_by?: string | null
          counted_cash_minor?: number | null
          created_at?: string
          expected_cash_minor?: number | null
          id?: string
          opened_at?: string
          opened_by: string
          opening_balance_minor: number
          status?: string
          tenant_id: string
          variance_minor?: number | null
        }
        Update: {
          branch_id?: string
          closed_at?: string | null
          closed_by?: string | null
          counted_cash_minor?: number | null
          created_at?: string
          expected_cash_minor?: number | null
          id?: string
          opened_at?: string
          opened_by?: string
          opening_balance_minor?: number
          status?: string
          tenant_id?: string
          variance_minor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_shifts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_shifts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "effective_menu_items"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "cash_shifts_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_shifts_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_shifts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      comps: {
        Row: {
          amount_minor: number
          branch_id: string
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          order_id: string
          reason_code_id: string
          tenant_id: string
        }
        Insert: {
          amount_minor: number
          branch_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          order_id: string
          reason_code_id: string
          tenant_id: string
        }
        Update: {
          amount_minor?: number
          branch_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          order_id?: string
          reason_code_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comps_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comps_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "effective_menu_items"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "comps_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comps_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comps_reason_code_id_fkey"
            columns: ["reason_code_id"]
            isOneToOne: false
            referencedRelation: "reason_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comps_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      content_translations: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          field: string
          id: string
          locale: string
          tenant_id: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          field: string
          id?: string
          locale: string
          tenant_id: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          field?: string
          id?: string
          locale?: string
          tenant_id?: string
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_translations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_redemptions: {
        Row: {
          comp_id: string | null
          coupon_id: string
          created_at: string
          id: string
          order_id: string
          tenant_id: string
        }
        Insert: {
          comp_id?: string | null
          coupon_id: string
          created_at?: string
          id?: string
          order_id: string
          tenant_id: string
        }
        Update: {
          comp_id?: string | null
          coupon_id?: string
          created_at?: string
          id?: string
          order_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_comp_id_fkey"
            columns: ["comp_id"]
            isOneToOne: false
            referencedRelation: "comps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          campaign_id: string
          code: string
          created_at: string
          id: string
          is_active: boolean
          tenant_id: string
          usage_limit: number | null
          used_count: number
        }
        Insert: {
          campaign_id: string
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          tenant_id: string
          usage_limit?: number | null
          used_count?: number
        }
        Update: {
          campaign_id?: string
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          tenant_id?: string
          usage_limit?: number | null
          used_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "coupons_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_assignments: {
        Row: {
          assigned_at: string
          branch_id: string
          courier_id: string
          created_at: string
          delivered_at: string | null
          en_route_at: string | null
          id: string
          order_id: string
          status: string
          tenant_id: string
        }
        Insert: {
          assigned_at?: string
          branch_id: string
          courier_id: string
          created_at?: string
          delivered_at?: string | null
          en_route_at?: string | null
          id?: string
          order_id: string
          status?: string
          tenant_id: string
        }
        Update: {
          assigned_at?: string
          branch_id?: string
          courier_id?: string
          created_at?: string
          delivered_at?: string | null
          en_route_at?: string | null
          id?: string
          order_id?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "courier_assignments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_assignments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "effective_menu_items"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "courier_assignments_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_assignments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          address_text: string
          created_at: string
          customer_id: string
          id: string
          is_default: boolean
          label: string | null
          tenant_id: string
          zone_id: string | null
        }
        Insert: {
          address_text: string
          created_at?: string
          customer_id: string
          id?: string
          is_default?: boolean
          label?: string | null
          tenant_id: string
          zone_id?: string | null
        }
        Update: {
          address_text?: string
          created_at?: string
          customer_id?: string
          id?: string
          is_default?: boolean
          label?: string | null
          tenant_id?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_addresses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_addresses_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_segments: {
        Row: {
          created_at: string
          criteria: Json
          id: string
          name: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          criteria?: Json
          id?: string
          name: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          criteria?: Json
          id?: string
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_segments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          id: string
          kvkk_consented_at: string
          phone: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kvkk_consented_at: string
          phone: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kvkk_consented_at?: string
          phone?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_sales_summary: {
        Row: {
          branch_id: string
          business_date: string
          card_manual_minor: number
          cash_minor: number
          comps_minor: number
          created_at: string
          online_minor: number
          order_count: number
          refunds_minor: number
          revenue_minor: number
          tenant_id: string
          tips_minor: number
        }
        Insert: {
          branch_id: string
          business_date: string
          card_manual_minor: number
          cash_minor: number
          comps_minor: number
          created_at?: string
          online_minor: number
          order_count: number
          refunds_minor: number
          revenue_minor: number
          tenant_id: string
          tips_minor: number
        }
        Update: {
          branch_id?: string
          business_date?: string
          card_manual_minor?: number
          cash_minor?: number
          comps_minor?: number
          created_at?: string
          online_minor?: number
          order_count?: number
          refunds_minor?: number
          revenue_minor?: number
          tenant_id?: string
          tips_minor?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_sales_summary_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_sales_summary_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "effective_menu_items"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "daily_sales_summary_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_widgets: {
        Row: {
          created_at: string
          is_visible: boolean
          position: number
          tenant_id: string
          updated_at: string
          user_id: string
          widget_key: string
        }
        Insert: {
          created_at?: string
          is_visible?: boolean
          position?: number
          tenant_id: string
          updated_at?: string
          user_id: string
          widget_key: string
        }
        Update: {
          created_at?: string
          is_visible?: boolean
          position?: number
          tenant_id?: string
          updated_at?: string
          user_id?: string
          widget_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_widgets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboard_widgets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      day_closures: {
        Row: {
          branch_id: string
          business_date: string
          cancelled_orders_count: number
          card_manual_minor: number
          cash_minor: number
          closed_by: string | null
          comps_minor: number
          created_at: string
          id: string
          online_minor: number
          refunds_minor: number
          revenue_minor: number
          tenant_id: string
          tips_minor: number
        }
        Insert: {
          branch_id: string
          business_date: string
          cancelled_orders_count: number
          card_manual_minor: number
          cash_minor: number
          closed_by?: string | null
          comps_minor: number
          created_at?: string
          id?: string
          online_minor: number
          refunds_minor: number
          revenue_minor: number
          tenant_id: string
          tips_minor: number
        }
        Update: {
          branch_id?: string
          business_date?: string
          cancelled_orders_count?: number
          card_manual_minor?: number
          cash_minor?: number
          closed_by?: string | null
          comps_minor?: number
          created_at?: string
          id?: string
          online_minor?: number
          refunds_minor?: number
          revenue_minor?: number
          tenant_id?: string
          tips_minor?: number
        }
        Relationships: [
          {
            foreignKeyName: "day_closures_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "day_closures_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "effective_menu_items"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "day_closures_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "day_closures_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_zones: {
        Row: {
          branch_id: string
          created_at: string
          fee_minor: number
          id: string
          is_active: boolean
          min_basket_minor: number
          name: string
          tenant_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          fee_minor?: number
          id?: string
          is_active?: boolean
          min_basket_minor?: number
          name: string
          tenant_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          fee_minor?: number
          id?: string
          is_active?: boolean
          min_basket_minor?: number
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_zones_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_zones_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "effective_menu_items"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "delivery_zones_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      generic_qr_codes: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          is_active: boolean
          label: string
          qr_token_hash: string
          tenant_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          qr_token_hash: string
          tenant_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          qr_token_hash?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generic_qr_codes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generic_qr_codes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "effective_menu_items"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "generic_qr_codes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_card_transactions: {
        Row: {
          amount_minor: number
          branch_id: string | null
          created_at: string
          created_by: string | null
          gift_card_id: string
          id: string
          order_id: string | null
          payment_id: string | null
          tenant_id: string
          type: string
        }
        Insert: {
          amount_minor: number
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          gift_card_id: string
          id?: string
          order_id?: string | null
          payment_id?: string | null
          tenant_id: string
          type: string
        }
        Update: {
          amount_minor?: number
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          gift_card_id?: string
          id?: string
          order_id?: string | null
          payment_id?: string | null
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_card_transactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_card_transactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "effective_menu_items"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "gift_card_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_card_transactions_gift_card_id_fkey"
            columns: ["gift_card_id"]
            isOneToOne: false
            referencedRelation: "gift_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_card_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_card_transactions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_card_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_cards: {
        Row: {
          balance_minor: number
          code: string
          created_at: string
          id: string
          is_active: boolean
          tenant_id: string
        }
        Insert: {
          balance_minor?: number
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          tenant_id: string
        }
        Update: {
          balance_minor?: number
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_cards_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          branch_id: string
          created_at: string
          period_month: string
          target_revenue_minor: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          period_month: string
          target_revenue_minor: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          period_month?: string
          target_revenue_minor?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "effective_menu_items"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "goals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_updates: {
        Row: {
          body: string
          created_at: string
          id: string
          incident_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          incident_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          incident_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_updates_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          created_at: string
          id: string
          resolved_at: string | null
          started_at: string
          status: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          resolved_at?: string | null
          started_at?: string
          status?: string
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          resolved_at?: string | null
          started_at?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
      ingredients: {
        Row: {
          avg_cost_minor_per_unit: number
          created_at: string
          critical_level: number
          current_stock: number
          id: string
          is_active: boolean
          name: string
          tenant_id: string
          unit: string
          updated_at: string
        }
        Insert: {
          avg_cost_minor_per_unit?: number
          created_at?: string
          critical_level?: number
          current_stock?: number
          id?: string
          is_active?: boolean
          name: string
          tenant_id: string
          unit: string
          updated_at?: string
        }
        Update: {
          avg_cost_minor_per_unit?: number
          created_at?: string
          critical_level?: number
          current_stock?: number
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      kiosk_devices: {
        Row: {
          branch_id: string
          created_at: string
          device_name: string
          id: string
          is_active: boolean
          last_active_at: string | null
          pairing_code: string
          tenant_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          device_name: string
          id?: string
          is_active?: boolean
          last_active_at?: string | null
          pairing_code: string
          tenant_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          device_name?: string
          id?: string
          is_active?: boolean
          last_active_at?: string | null
          pairing_code?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kiosk_devices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kiosk_devices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "effective_menu_items"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "kiosk_devices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      licenses: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          issued_at: string
          license_key: string
          license_type: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          issued_at?: string
          license_key: string
          license_type: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          issued_at?: string
          license_key?: string
          license_type?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "licenses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_balances: {
        Row: {
          balance: number
          customer_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          balance?: number
          customer_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          balance?: number
          customer_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_balances_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_balances_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_programs: {
        Row: {
          config: Json
          created_at: string
          is_active: boolean
          mode: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          is_active?: boolean
          mode: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          is_active?: boolean
          mode?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_programs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_transactions: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          delta: number
          id: string
          order_id: string | null
          tenant_id: string
          type: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          delta: number
          id?: string
          order_id?: string | null
          tenant_id: string
          type: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          delta?: number
          id?: string
          order_id?: string | null
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_transactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "effective_menu_items"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "loyalty_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_categories: {
        Row: {
          created_at: string
          display_order: number
          id: string
          image_url: string | null
          is_active: boolean
          layout: string
          station: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          layout?: string
          station?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          layout?: string
          station?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      module_requests: {
        Row: {
          id: string
          module_key: string
          requested_at: string
          resolved_at: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          id?: string
          module_key: string
          requested_at?: string
          resolved_at?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          id?: string
          module_key?: string
          requested_at?: string
          resolved_at?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item_extras: {
        Row: {
          branch_id: string
          created_at: string
          extra_id: string
          extra_name_snapshot: string
          id: string
          order_item_id: string
          table_session_id: string
          tenant_id: string
          unit_price_minor: number
        }
        Insert: {
          branch_id: string
          created_at?: string
          extra_id: string
          extra_name_snapshot: string
          id?: string
          order_item_id: string
          table_session_id: string
          tenant_id: string
          unit_price_minor: number
        }
        Update: {
          branch_id?: string
          created_at?: string
          extra_id?: string
          extra_name_snapshot?: string
          id?: string
          order_item_id?: string
          table_session_id?: string
          tenant_id?: string
          unit_price_minor?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_item_extras_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_extras_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "effective_menu_items"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "order_item_extras_extra_id_fkey"
            columns: ["extra_id"]
            isOneToOne: false
            referencedRelation: "product_extras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_extras_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_extras_table_session_id_fkey"
            columns: ["table_session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_extras_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          line_subtotal_minor: number
          order_id: string
          product_id: string
          product_name_snapshot: string
          quantity: number
          table_session_id: string
          tenant_id: string
          unit_price_minor: number
          variant_id: string | null
          variant_name_snapshot: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          line_subtotal_minor: number
          order_id: string
          product_id: string
          product_name_snapshot: string
          quantity: number
          table_session_id: string
          tenant_id: string
          unit_price_minor: number
          variant_id?: string | null
          variant_name_snapshot?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          line_subtotal_minor?: number
          order_id?: string
          product_id?: string
          product_name_snapshot?: string
          quantity?: number
          table_session_id?: string
          tenant_id?: string
          unit_price_minor?: number
          variant_id?: string | null
          variant_name_snapshot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "effective_menu_items"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "effective_menu_items"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_table_session_id_fkey"
            columns: ["table_session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "effective_menu_items"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          branch_id: string
          cancel_reason_code_id: string | null
          cancel_requested_at: string | null
          cancel_requested_reason: string | null
          channel: string
          created_at: string
          delivery_address_snapshot: string | null
          delivery_fee_minor: number
          delivery_zone_id: string | null
          id: string
          idempotency_key: string
          placed_by_device_id: string | null
          scheduled_for: string | null
          status: string
          subtotal_minor: number
          table_session_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          cancel_reason_code_id?: string | null
          cancel_requested_at?: string | null
          cancel_requested_reason?: string | null
          channel?: string
          created_at?: string
          delivery_address_snapshot?: string | null
          delivery_fee_minor?: number
          delivery_zone_id?: string | null
          id?: string
          idempotency_key: string
          placed_by_device_id?: string | null
          scheduled_for?: string | null
          status?: string
          subtotal_minor?: number
          table_session_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          cancel_reason_code_id?: string | null
          cancel_requested_at?: string | null
          cancel_requested_reason?: string | null
          channel?: string
          created_at?: string
          delivery_address_snapshot?: string | null
          delivery_fee_minor?: number
          delivery_zone_id?: string | null
          id?: string
          idempotency_key?: string
          placed_by_device_id?: string | null
          scheduled_for?: string | null
          status?: string
          subtotal_minor?: number
          table_session_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "effective_menu_items"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "orders_cancel_reason_code_id_fkey"
            columns: ["cancel_reason_code_id"]
            isOneToOne: false
            referencedRelation: "reason_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_zone_id_fkey"
            columns: ["delivery_zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_placed_by_device_id_fkey"
            columns: ["placed_by_device_id"]
            isOneToOne: false
            referencedRelation: "table_session_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_table_session_id_fkey"
            columns: ["table_session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_codes: {
        Row: {
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          phone: string
          tenant_id: string
        }
        Insert: {
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          phone: string
          tenant_id: string
        }
        Update: {
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "otp_codes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_item_allocations: {
        Row: {
          amount_minor: number
          branch_id: string
          created_at: string
          id: string
          order_item_id: string
          payment_id: string
          quantity: number
          tenant_id: string
        }
        Insert: {
          amount_minor: number
          branch_id: string
          created_at?: string
          id?: string
          order_item_id: string
          payment_id: string
          quantity: number
          tenant_id: string
        }
        Update: {
          amount_minor?: number
          branch_id?: string
          created_at?: string
          id?: string
          order_item_id?: string
          payment_id?: string
          quantity?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_item_allocations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_item_allocations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "effective_menu_items"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "payment_item_allocations_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_item_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_item_allocations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_minor: number
          branch_id: string
          created_at: string
          created_by: string | null
          id: string
          method: string
          provider: string
          provider_ref: string | null
          split_group: string | null
          status: string
          table_session_id: string
          tenant_id: string
          tip_amount_minor: number
        }
        Insert: {
          amount_minor: number
          branch_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          method: string
          provider?: string
          provider_ref?: string | null
          split_group?: string | null
          status?: string
          table_session_id: string
          tenant_id: string
          tip_amount_minor?: number
        }
        Update: {
          amount_minor?: number
          branch_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string
          provider?: string
          provider_ref?: string | null
          split_group?: string | null
          status?: string
          table_session_id?: string
          tenant_id?: string
          tip_amount_minor?: number
        }
        Relationships: [
          {
            foreignKeyName: "payments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "effective_menu_items"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_table_session_id_fkey"
            columns: ["table_session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_modules: {
        Row: {
          module_key: string
          plan_id: string
        }
        Insert: {
          module_key: string
          plan_id: string
        }
        Update: {
          module_key?: string
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_modules_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          extra_branch_price_minor: number
          id: string
          included_branch_count: number
          key: string
          name: string
          price_minor: number
          table_limit: number | null
        }
        Insert: {
          created_at?: string
          extra_branch_price_minor?: number
          id?: string
          included_branch_count?: number
          key: string
          name: string
          price_minor?: number
          table_limit?: number | null
        }
        Update: {
          created_at?: string
          extra_branch_price_minor?: number
          id?: string
          included_branch_count?: number
          key?: string
          name?: string
          price_minor?: number
          table_limit?: number | null
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
        }
        Insert: {
          created_at?: string
          id: string
          is_active?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          auto_approve_registrations: boolean
          enforce_2fa: boolean
          id: boolean
          updated_at: string
        }
        Insert: {
          auto_approve_registrations?: boolean
          enforce_2fa?: boolean
          id?: boolean
          updated_at?: string
        }
        Update: {
          auto_approve_registrations?: boolean
          enforce_2fa?: boolean
          id?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      product_costs: {
        Row: {
          cost_minor: number
          product_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          cost_minor: number
          product_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          cost_minor?: number
          product_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_costs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "effective_menu_items"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_costs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_costs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_external_mappings: {
        Row: {
          created_at: string
          external_sku: string
          id: string
          product_id: string
          provider: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          external_sku: string
          id?: string
          product_id: string
          provider: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          external_sku?: string
          id?: string
          product_id?: string
          provider?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_external_mappings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "effective_menu_items"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_external_mappings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_external_mappings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_extras: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          is_sold_out: boolean
          price_minor: number
          product_id: string
          stock_quantity: number | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          is_sold_out?: boolean
          price_minor?: number
          product_id: string
          stock_quantity?: number | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          is_sold_out?: boolean
          price_minor?: number
          product_id?: string
          stock_quantity?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_extras_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "effective_menu_items"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_extras_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_extras_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          created_at: string
          id: string
          storage_path: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          storage_path: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          storage_path?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          is_sold_out: boolean
          price_minor: number
          product_id: string
          stock_quantity: number | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          is_sold_out?: boolean
          price_minor: number
          product_id: string
          stock_quantity?: number | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          is_sold_out?: boolean
          price_minor?: number
          product_id?: string
          stock_quantity?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "effective_menu_items"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          base_price_minor: number
          category_id: string
          created_at: string
          display_order: number
          id: string
          image_url: string | null
          is_active: boolean
          is_sold_out: boolean
          stock_quantity: number | null
          tenant_id: string
          track_mode: string
          updated_at: string
        }
        Insert: {
          base_price_minor: number
          category_id: string
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_sold_out?: boolean
          stock_quantity?: number | null
          tenant_id: string
          track_mode?: string
          updated_at?: string
        }
        Update: {
          base_price_minor?: number
          category_id?: string
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_sold_out?: boolean
          stock_quantity?: number | null
          tenant_id?: string
          track_mode?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          badge_no: string | null
          created_at: string
          id: string
          is_active: boolean
          photo_url: string | null
          pin_hash: string | null
          role: string
          tenant_id: string
        }
        Insert: {
          badge_no?: string | null
          created_at?: string
          id: string
          is_active?: boolean
          photo_url?: string | null
          pin_hash?: string | null
          role: string
          tenant_id: string
        }
        Update: {
          badge_no?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          photo_url?: string | null
          pin_hash?: string | null
          role?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          id: string
          ingredient_id: string
          quantity: number
          supplier_id: string | null
          tenant_id: string
          unit_cost_minor: number
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          ingredient_id: string
          quantity: number
          supplier_id?: string | null
          tenant_id: string
          unit_cost_minor: number
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          ingredient_id?: string
          quantity?: number
          supplier_id?: string | null
          tenant_id?: string
          unit_cost_minor?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchases_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "effective_menu_items"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "purchases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      rating_settings: {
        Row: {
          created_at: string
          google_review_url: string | null
          is_enabled: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          google_review_url?: string | null
          is_enabled?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          google_review_url?: string | null
          is_enabled?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rating_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ratings: {
        Row: {
          branch_id: string
          comment: string | null
          created_at: string
          id: string
          rated_staff_id: string | null
          staff_stars: number | null
          stars: number
          table_session_id: string
          tenant_id: string
        }
        Insert: {
          branch_id: string
          comment?: string | null
          created_at?: string
          id?: string
          rated_staff_id?: string | null
          staff_stars?: number | null
          stars: number
          table_session_id: string
          tenant_id: string
        }
        Update: {
          branch_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          rated_staff_id?: string | null
          staff_stars?: number | null
          stars?: number
          table_session_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ratings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "effective_menu_items"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "ratings_rated_staff_id_fkey"
            columns: ["rated_staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_table_session_id_fkey"
            columns: ["table_session_id"]
            isOneToOne: true
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      reason_codes: {
        Row: {
          category: string
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          key: string
          tenant_id: string
        }
        Insert: {
          category: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          key: string
          tenant_id: string
        }
        Update: {
          category?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          key?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reason_codes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_items: {
        Row: {
          id: string
          ingredient_id: string
          quantity_per_unit: number
          recipe_id: string
          tenant_id: string
        }
        Insert: {
          id?: string
          ingredient_id: string
          quantity_per_unit: number
          recipe_id: string
          tenant_id: string
        }
        Update: {
          id?: string
          ingredient_id?: string
          quantity_per_unit?: number
          recipe_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_items_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          created_at: string
          id: string
          product_id: string
          tenant_id: string
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          tenant_id: string
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          tenant_id?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "effective_menu_items"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "recipes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "effective_menu_items"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "recipes_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      refund_item_allocations: {
        Row: {
          amount_minor: number
          branch_id: string
          created_at: string
          id: string
          order_item_id: string
          quantity: number
          refund_id: string
          tenant_id: string
        }
        Insert: {
          amount_minor: number
          branch_id: string
          created_at?: string
          id?: string
          order_item_id: string
          quantity: number
          refund_id: string
          tenant_id: string
        }
        Update: {
          amount_minor?: number
          branch_id?: string
          created_at?: string
          id?: string
          order_item_id?: string
          quantity?: number
          refund_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "refund_item_allocations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_item_allocations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "effective_menu_items"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "refund_item_allocations_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_item_allocations_refund_id_fkey"
            columns: ["refund_id"]
            isOneToOne: false
            referencedRelation: "refunds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_item_allocations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      refunds: {
        Row: {
          amount_minor: number
          branch_id: string
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          payment_id: string
          provider_ref: string | null
          reason_code_id: string
          tenant_id: string
        }
        Insert: {
          amount_minor: number
          branch_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          payment_id: string
          provider_ref?: string | null
          reason_code_id: string
          tenant_id: string
        }
        Update: {
          amount_minor?: number
          branch_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          payment_id?: string
          provider_ref?: string | null
          reason_code_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "effective_menu_items"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "refunds_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_reason_code_id_fkey"
            columns: ["reason_code_id"]
            isOneToOne: false
            referencedRelation: "reason_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      report_schedules: {
        Row: {
          branch_id: string
          created_at: string
          frequency: string
          id: string
          is_active: boolean
          last_sent_at: string | null
          recipient_email: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          frequency: string
          id?: string
          is_active?: boolean
          last_sent_at?: string | null
          recipient_email: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          frequency?: string
          id?: string
          is_active?: boolean
          last_sent_at?: string | null
          recipient_email?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_schedules_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_schedules_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "effective_menu_items"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "report_schedules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          branch_id: string
          cancelled_at: string | null
          confirmed_at: string | null
          created_at: string
          created_by: string | null
          customer_name: string
          customer_phone: string
          id: string
          note: string | null
          party_size: number
          reserved_at: string
          seated_at: string | null
          status: string
          table_id: string | null
          tenant_id: string
        }
        Insert: {
          branch_id: string
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_name: string
          customer_phone: string
          id?: string
          note?: string | null
          party_size: number
          reserved_at: string
          seated_at?: string | null
          status?: string
          table_id?: string | null
          tenant_id: string
        }
        Update: {
          branch_id?: string
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_name?: string
          customer_phone?: string
          id?: string
          note?: string | null
          party_size?: number
          reserved_at?: string
          seated_at?: string | null
          status?: string
          table_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "effective_menu_items"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "reservations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          allowed: boolean
          created_at: string
          id: string
          permission_key: string
          role: string
          tenant_id: string
        }
        Insert: {
          allowed?: boolean
          created_at?: string
          id?: string
          permission_key: string
          role: string
          tenant_id: string
        }
        Update: {
          allowed?: boolean
          created_at?: string
          id?: string
          permission_key?: string
          role?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sent_emails: {
        Row: {
          created_at: string
          has_attachment: boolean
          id: string
          provider: string
          subject: string
          tenant_id: string
          to_email: string
        }
        Insert: {
          created_at?: string
          has_attachment?: boolean
          id?: string
          provider: string
          subject: string
          tenant_id: string
          to_email: string
        }
        Update: {
          created_at?: string
          has_attachment?: boolean
          id?: string
          provider?: string
          subject?: string
          tenant_id?: string
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "sent_emails_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sent_sms: {
        Row: {
          body: string
          created_at: string
          id: string
          phone: string
          provider: string
          tenant_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          phone: string
          provider: string
          tenant_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          phone?: string
          provider?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sent_sms_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      session_events: {
        Row: {
          actor_profile_id: string | null
          branch_id: string
          created_at: string
          event_type: string
          from_table_id: string | null
          id: string
          reason: string | null
          table_session_id: string
          tenant_id: string
          to_table_id: string | null
        }
        Insert: {
          actor_profile_id?: string | null
          branch_id: string
          created_at?: string
          event_type: string
          from_table_id?: string | null
          id?: string
          reason?: string | null
          table_session_id: string
          tenant_id: string
          to_table_id?: string | null
        }
        Update: {
          actor_profile_id?: string | null
          branch_id?: string
          created_at?: string
          event_type?: string
          from_table_id?: string | null
          id?: string
          reason?: string | null
          table_session_id?: string
          tenant_id?: string
          to_table_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_events_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_events_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_events_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "effective_menu_items"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "session_events_from_table_id_fkey"
            columns: ["from_table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_events_table_session_id_fkey"
            columns: ["table_session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_events_to_table_id_fkey"
            columns: ["to_table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_branch_assignments: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          profile_id: string
          tenant_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          profile_id: string
          tenant_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          profile_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_branch_assignments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_branch_assignments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "effective_menu_items"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "staff_branch_assignments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_branch_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_devices: {
        Row: {
          branch_id: string
          created_at: string
          device_label: string
          device_secret_hash: string
          failed_pin_attempts: number
          id: string
          is_active: boolean
          last_seen_at: string | null
          locked_until: string | null
          tenant_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          device_label: string
          device_secret_hash: string
          failed_pin_attempts?: number
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          locked_until?: string | null
          tenant_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          device_label?: string
          device_secret_hash?: string
          failed_pin_attempts?: number
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          locked_until?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_devices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_devices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "effective_menu_items"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "staff_devices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_shifts: {
        Row: {
          branch_id: string
          created_at: string
          end_time: string
          id: string
          profile_id: string
          shift_date: string
          start_time: string
          tenant_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          end_time: string
          id?: string
          profile_id: string
          shift_date: string
          start_time: string
          tenant_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          end_time?: string
          id?: string
          profile_id?: string
          shift_date?: string
          start_time?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_shifts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_shifts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "effective_menu_items"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "staff_shifts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_shifts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          id: string
          ingredient_id: string
          note: string | null
          order_id: string | null
          quantity_delta: number
          tenant_id: string
          type: string
          unit_cost_minor_snapshot: number
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          ingredient_id: string
          note?: string | null
          order_id?: string | null
          quantity_delta: number
          tenant_id: string
          type: string
          unit_cost_minor_snapshot?: number
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          ingredient_id?: string
          note?: string | null
          order_id?: string | null
          quantity_delta?: number
          tenant_id?: string
          type?: string
          unit_cost_minor_snapshot?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "effective_menu_items"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "stock_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          pending_plan_id: string | null
          provider: string | null
          provider_ref: string | null
          status: string
          tenant_id: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          pending_plan_id?: string | null
          provider?: string | null
          provider_ref?: string | null
          status?: string
          tenant_id: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          pending_plan_id?: string | null
          provider?: string | null
          provider_ref?: string | null
          status?: string
          tenant_id?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_pending_plan_id_fkey"
            columns: ["pending_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          contact_info: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          tenant_id: string
        }
        Insert: {
          contact_info?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          tenant_id: string
        }
        Update: {
          contact_info?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          status: string
          subject: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          status?: string
          subject: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          status?: string
          subject?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      table_session_devices: {
        Row: {
          branch_id: string
          created_at: string
          device_label: string
          guest_user_id: string
          id: string
          last_seen_at: string
          table_session_id: string
          tenant_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          device_label: string
          guest_user_id: string
          id?: string
          last_seen_at?: string
          table_session_id: string
          tenant_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          device_label?: string
          guest_user_id?: string
          id?: string
          last_seen_at?: string
          table_session_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_session_devices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_session_devices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "effective_menu_items"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "table_session_devices_table_session_id_fkey"
            columns: ["table_session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_session_devices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      table_sessions: {
        Row: {
          branch_id: string
          channel: string
          close_reason: string | null
          closed_at: string | null
          created_at: string
          customer_id: string | null
          external_order_id: string | null
          external_provider: string | null
          id: string
          kiosk_device_id: string | null
          last_activity_at: string
          opened_at: string
          pickup_code: string | null
          status: string
          table_id: string | null
          tenant_id: string
        }
        Insert: {
          branch_id: string
          channel?: string
          close_reason?: string | null
          closed_at?: string | null
          created_at?: string
          customer_id?: string | null
          external_order_id?: string | null
          external_provider?: string | null
          id?: string
          kiosk_device_id?: string | null
          last_activity_at?: string
          opened_at?: string
          pickup_code?: string | null
          status?: string
          table_id?: string | null
          tenant_id: string
        }
        Update: {
          branch_id?: string
          channel?: string
          close_reason?: string | null
          closed_at?: string | null
          created_at?: string
          customer_id?: string | null
          external_order_id?: string | null
          external_provider?: string | null
          id?: string
          kiosk_device_id?: string | null
          last_activity_at?: string
          opened_at?: string
          pickup_code?: string | null
          status?: string
          table_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_sessions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_sessions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "effective_menu_items"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "table_sessions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_sessions_kiosk_device_id_fkey"
            columns: ["kiosk_device_id"]
            isOneToOne: false
            referencedRelation: "kiosk_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_sessions_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      table_zones: {
        Row: {
          branch_id: string
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          name: string
          tenant_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          tenant_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_zones_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_zones_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "effective_menu_items"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "table_zones_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tables: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          is_active: boolean
          is_counter: boolean
          label: string
          qr_token_hash: string
          tenant_id: string
          zone_id: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_counter?: boolean
          label: string
          qr_token_hash: string
          tenant_id: string
          zone_id?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_counter?: boolean
          label?: string
          qr_token_hash?: string
          tenant_id?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tables_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tables_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "effective_menu_items"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "tables_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tables_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "table_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_domains: {
        Row: {
          created_at: string
          domain: string
          id: string
          is_primary: boolean
          tenant_id: string
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          is_primary?: boolean
          tenant_id: string
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          is_primary?: boolean
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_domains_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_locales: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          locale: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          locale: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          locale?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_locales_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_modules: {
        Row: {
          id: string
          is_enabled: boolean
          module_key: string
          pending_removal_since: string | null
          source: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          id?: string
          is_enabled?: boolean
          module_key: string
          pending_removal_since?: string | null
          source?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          id?: string
          is_enabled?: boolean
          module_key?: string
          pending_removal_since?: string | null
          source?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_modules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_settings: {
        Row: {
          created_at: string
          order_mode: string
          session_timeout_minutes: number
          tenant_id: string
          theme_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          order_mode?: string
          session_timeout_minutes?: number
          tenant_id: string
          theme_key?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          order_mode?: string
          session_timeout_minutes?: number
          tenant_id?: string
          theme_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_settings_theme_key_fkey"
            columns: ["theme_key"]
            isOneToOne: false
            referencedRelation: "themes"
            referencedColumns: ["key"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          currency: string
          deletion_requested_at: string | null
          id: string
          logo_url: string | null
          name: string
          onboarding_completed_at: string | null
          plan_id: string | null
          slug: string
          status: string
          timezone: string
        }
        Insert: {
          created_at?: string
          currency?: string
          deletion_requested_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          onboarding_completed_at?: string | null
          plan_id?: string | null
          slug: string
          status?: string
          timezone?: string
        }
        Update: {
          created_at?: string
          currency?: string
          deletion_requested_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          onboarding_completed_at?: string | null
          plan_id?: string | null
          slug?: string
          status?: string
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenants_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      themes: {
        Row: {
          created_at: string
          is_public: boolean
          key: string
          name: string
        }
        Insert: {
          created_at?: string
          is_public?: boolean
          key: string
          name: string
        }
        Update: {
          created_at?: string
          is_public?: boolean
          key?: string
          name?: string
        }
        Relationships: []
      }
      ticket_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          sender: string
          tenant_id: string
          ticket_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          sender: string
          tenant_id: string
          ticket_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          sender?: string
          tenant_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      timeclock_entries: {
        Row: {
          branch_id: string
          clock_in_at: string
          clock_out_at: string | null
          created_at: string
          device_id: string | null
          id: string
          profile_id: string
          tenant_id: string
        }
        Insert: {
          branch_id: string
          clock_in_at?: string
          clock_out_at?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          profile_id: string
          tenant_id: string
        }
        Update: {
          branch_id?: string
          clock_in_at?: string
          clock_out_at?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          profile_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "timeclock_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeclock_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "effective_menu_items"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "timeclock_entries_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "staff_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeclock_entries_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeclock_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tip_presets: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          label: string
          percentage: number
          tenant_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          label: string
          percentage: number
          tenant_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          label?: string
          percentage?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tip_presets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      waiter_calls: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          branch_id: string
          call_type_id: string | null
          created_at: string
          id: string
          note: string | null
          status: string
          table_session_id: string
          tenant_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          branch_id: string
          call_type_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          status?: string
          table_session_id: string
          tenant_id: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          branch_id?: string
          call_type_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          status?: string
          table_session_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waiter_calls_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiter_calls_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiter_calls_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "effective_menu_items"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "waiter_calls_call_type_id_fkey"
            columns: ["call_type_id"]
            isOneToOne: false
            referencedRelation: "call_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiter_calls_table_session_id_fkey"
            columns: ["table_session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiter_calls_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_entries: {
        Row: {
          branch_id: string
          called_at: string | null
          created_at: string
          customer_name: string
          customer_phone: string | null
          id: string
          party_size: number
          seated_at: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          branch_id: string
          called_at?: string | null
          created_at?: string
          customer_name: string
          customer_phone?: string | null
          id?: string
          party_size: number
          seated_at?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          branch_id?: string
          called_at?: string | null
          created_at?: string
          customer_name?: string
          customer_phone?: string | null
          id?: string
          party_size?: number
          seated_at?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "effective_menu_items"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "waitlist_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_deliveries: {
        Row: {
          attempt_count: number
          created_at: string
          delivered_at: string | null
          event_type: string
          id: string
          next_retry_at: string
          payload: Json
          pg_net_request_id: number | null
          status: string
          tenant_id: string
          webhook_id: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          delivered_at?: string | null
          event_type: string
          id?: string
          next_retry_at?: string
          payload: Json
          pg_net_request_id?: number | null
          status?: string
          tenant_id: string
          webhook_id: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          delivered_at?: string | null
          event_type?: string
          id?: string
          next_retry_at?: string
          payload?: Json
          pg_net_request_id?: number | null
          status?: string
          tenant_id?: string
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_deliveries_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks: {
        Row: {
          created_at: string
          event_types: string[]
          id: string
          is_active: boolean
          secret: string
          tenant_id: string
          url: string
        }
        Insert: {
          created_at?: string
          event_types: string[]
          id?: string
          is_active?: boolean
          secret: string
          tenant_id: string
          url: string
        }
        Update: {
          created_at?: string
          event_types?: string[]
          id?: string
          is_active?: boolean
          secret?: string
          tenant_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhooks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      effective_menu_items: {
        Row: {
          branch_id: string | null
          category_id: string | null
          effective_price_minor: number | null
          is_orderable: boolean | null
          product_id: string | null
          tenant_id: string | null
          variant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      acknowledge_anomaly_alert: {
        Args: { p_alert_id: string }
        Returns: undefined
      }
      acknowledge_waiter_call: {
        Args: { p_call_id: string }
        Returns: undefined
      }
      activate_subscription: {
        Args: { p_provider: string; p_provider_ref: string }
        Returns: undefined
      }
      advance_courier_assignment: {
        Args: { p_assignment_id: string; p_to_status: string }
        Returns: undefined
      }
      advance_order_status: {
        Args: { p_order_id: string; p_to_status: string }
        Returns: undefined
      }
      apply_coupon_to_order: {
        Args: { p_code: string; p_order_id: string }
        Returns: number
      }
      apply_plan_change: {
        Args: { p_new_plan_id: string; p_tenant_id: string }
        Returns: undefined
      }
      approve_cancellation_request: {
        Args: { p_order_id: string; p_reason_code_id?: string }
        Returns: undefined
      }
      approve_order: { Args: { p_order_id: string }; Returns: undefined }
      approve_tenant: { Args: { p_tenant_id: string }; Returns: undefined }
      assign_courier: {
        Args: { p_courier_id: string; p_order_id: string }
        Returns: string
      }
      assign_tenant_plan: {
        Args: { p_plan_id: string; p_tenant_id: string }
        Returns: undefined
      }
      authenticate_api_key: { Args: { p_key_hash: string }; Returns: string }
      call_waiter: {
        Args: { p_call_type_key?: string; p_note?: string }
        Returns: string
      }
      cancel_order: { Args: { p_order_id: string }; Returns: undefined }
      cancel_subscription: { Args: never; Returns: undefined }
      clear_demo_data: { Args: never; Returns: undefined }
      clock_in_or_out: {
        Args: {
          p_device_id: string
          p_device_secret: string
          p_pin: string
          p_tenant_id: string
        }
        Returns: {
          action: string
          badge_no: string
        }[]
      }
      close_business_day: { Args: { p_branch_id: string }; Returns: string }
      close_kiosk_device_sessions: {
        Args: { p_device_id: string }
        Returns: undefined
      }
      close_shift: {
        Args: { p_counted_cash_minor: number; p_shift_id: string }
        Returns: undefined
      }
      close_stale_table_sessions: { Args: never; Returns: undefined }
      close_table_session: {
        Args: { p_reason: string; p_table_session_id: string }
        Returns: undefined
      }
      complete_onboarding: { Args: never; Returns: undefined }
      complete_online_payment: {
        Args: { p_provider: string; p_provider_ref: string }
        Returns: undefined
      }
      create_branch: {
        Args: { p_name: string }
        Returns: {
          branch_id: string
          extra_fee_applies: boolean
        }[]
      }
      create_pending_online_payment: {
        Args: {
          p_amount_minor: number
          p_provider: string
          p_provider_ref: string
          p_table_session_id: string
          p_tip_amount_minor: number
        }
        Returns: string
      }
      create_plan: {
        Args: {
          p_extra_branch_price_minor: number
          p_included_branch_count: number
          p_key: string
          p_name: string
          p_price_minor: number
          p_table_limit: number
        }
        Returns: string
      }
      create_staff_device: {
        Args: { p_branch_id: string; p_label: string }
        Returns: string
      }
      current_can: { Args: { p_permission_key: string }; Returns: boolean }
      current_guest_branch_id: { Args: never; Returns: string }
      current_role: { Args: never; Returns: string }
      current_table_session_id: { Args: never; Returns: string }
      current_tenant_id: { Args: never; Returns: string }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      deduct_recipe_stock: {
        Args: {
          p_branch_id: string
          p_order_id: string
          p_product_id: string
          p_quantity: number
          p_tenant_id: string
          p_variant_id: string
        }
        Returns: undefined
      }
      detect_revenue_anomalies: { Args: never; Returns: undefined }
      disable_tenant_locale: { Args: { p_locale: string }; Returns: undefined }
      dispatch_webhook_deliveries: { Args: never; Returns: undefined }
      enqueue_webhook_event: {
        Args: { p_event_type: string; p_payload: Json; p_tenant_id: string }
        Returns: undefined
      }
      get_active_anomaly_alerts: {
        Args: { p_branch_id: string }
        Returns: {
          business_date: string
          created_at: string
          id: string
          message: string
        }[]
      }
      get_branch_comparison: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: {
          branch_id: string
          branch_name: string
          order_count: number
          revenue_minor: number
        }[]
      }
      get_campaign_performance_report: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: {
          campaign_id: string
          campaign_name: string
          redemption_count: number
          total_discount_minor: number
        }[]
      }
      get_courier_daily_summary: {
        Args: { p_business_date: string; p_courier_id: string }
        Returns: {
          delivered_count: number
          total_amount_minor: number
        }[]
      }
      get_goal_progress: {
        Args: { p_branch_id: string; p_period_month: string }
        Returns: {
          actual_revenue_minor: number
          target_revenue_minor: number
        }[]
      }
      get_hourly_density: {
        Args: { p_branch_id: string; p_business_date: string }
        Returns: {
          hour_of_day: number
          order_count: number
        }[]
      }
      get_loss_report: {
        Args: { p_branch_id: string; p_end_date: string; p_start_date: string }
        Returns: {
          amount_minor: number
          item_count: number
          reason_code_id: string
          reason_key: string
          source: string
        }[]
      }
      get_loyalty_performance_report: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: {
          active_customers: number
          points_earned: number
          points_redeemed: number
          redemption_count: number
        }[]
      }
      get_margin_report: {
        Args: { p_branch_id: string; p_business_date: string }
        Returns: {
          cost_minor: number
          margin_minor: number
          product_name: string
          quantity: number
          revenue_minor: number
        }[]
      }
      get_menu_engineering_matrix: {
        Args: { p_branch_id: string; p_end_date: string; p_start_date: string }
        Returns: {
          category: string
          cost_minor: number
          margin_minor: number
          product_name: string
          quantity: number
          revenue_minor: number
        }[]
      }
      get_period_revenue_report: {
        Args: { p_branch_id: string; p_end_date: string; p_start_date: string }
        Returns: {
          card_manual_minor: number
          cash_minor: number
          comps_minor: number
          online_minor: number
          order_count: number
          refunds_minor: number
          revenue_minor: number
          tips_minor: number
        }[]
      }
      get_revenue_report: {
        Args: { p_branch_id: string; p_business_date: string }
        Returns: {
          card_manual_minor: number
          cash_minor: number
          comps_minor: number
          online_minor: number
          refunds_minor: number
          revenue_minor: number
          tips_minor: number
        }[]
      }
      get_shifts_for_date: {
        Args: { p_branch_id: string; p_business_date: string }
        Returns: {
          closed_at: string
          counted_cash_minor: number
          expected_cash_minor: number
          opened_at: string
          opening_balance_minor: number
          shift_id: string
          status: string
          variance_minor: number
        }[]
      }
      get_top_products: {
        Args: { p_branch_id: string; p_business_date: string }
        Returns: {
          product_name: string
          quantity: number
          revenue_minor: number
        }[]
      }
      ingest_marketplace_order: {
        Args: {
          p_external_order_id: string
          p_items: Json
          p_provider: string
          p_tenant_id: string
        }
        Returns: {
          is_duplicate: boolean
          order_id: string
        }[]
      }
      is_business_date_closed: {
        Args: { p_at?: string; p_branch_id: string }
        Returns: boolean
      }
      is_module_enabled: {
        Args: { p_module_key: string; p_tenant_id: string }
        Returns: boolean
      }
      is_platform_admin: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      is_subscription_active: {
        Args: { p_tenant_id: string }
        Returns: boolean
      }
      is_tenant_active: { Args: { p_tenant_id: string }; Returns: boolean }
      issue_gift_card: {
        Args: { p_code: string; p_initial_balance_minor: number }
        Returns: string
      }
      link_guest_device: {
        Args: {
          p_branch_id: string
          p_guest_user_id: string
          p_table_session_id: string
          p_tenant_id: string
        }
        Returns: string
      }
      list_branch_tables_for_generic_qr: {
        Args: { p_token_hash: string }
        Returns: {
          label: string
          table_id: string
        }[]
      }
      move_table_session: {
        Args: {
          p_reason?: string
          p_table_session_id: string
          p_to_table_id: string
        }
        Returns: undefined
      }
      open_delivery_session: { Args: { p_tenant_id: string }; Returns: string }
      open_kiosk_session: {
        Args: { p_pairing_code: string; p_tenant_id: string }
        Returns: {
          pickup_code: string
          table_session_id: string
        }[]
      }
      open_or_get_active_table_session: {
        Args: { p_table_id: string }
        Returns: string
      }
      open_pickup_session: {
        Args: { p_tenant_id: string }
        Returns: {
          pickup_code: string
          table_session_id: string
        }[]
      }
      open_shift: {
        Args: { p_branch_id: string; p_opening_balance_minor: number }
        Returns: string
      }
      reactivate_tenant: { Args: { p_tenant_id: string }; Returns: undefined }
      recompute_costs_for_ingredient: {
        Args: { p_ingredient_id: string }
        Returns: undefined
      }
      recompute_product_cost: {
        Args: { p_product_id: string }
        Returns: undefined
      }
      reconcile_webhook_deliveries: { Args: never; Returns: undefined }
      record_cash_movement: {
        Args: {
          p_amount_minor: number
          p_movement_type: string
          p_note?: string
          p_shift_id: string
        }
        Returns: string
      }
      record_comp: {
        Args: {
          p_amount_minor: number
          p_note?: string
          p_order_id: string
          p_reason_code_id: string
        }
        Returns: string
      }
      record_payment: {
        Args: {
          p_amount_minor: number
          p_gift_card_code?: string
          p_item_allocations?: Json
          p_method: string
          p_split_group?: string
          p_table_session_id: string
          p_tip_amount_minor?: number
        }
        Returns: string
      }
      record_purchase: {
        Args: {
          p_ingredient_id: string
          p_quantity: number
          p_supplier_id?: string
          p_unit_cost_minor: number
        }
        Returns: string
      }
      record_refund: {
        Args: {
          p_amount_minor: number
          p_item_allocations?: Json
          p_note?: string
          p_payment_id: string
          p_provider_ref?: string
          p_reason_code_id: string
        }
        Returns: string
      }
      record_stock_count: {
        Args: { p_counted_quantity: number; p_ingredient_id: string }
        Returns: undefined
      }
      record_stock_waste: {
        Args: { p_ingredient_id: string; p_note?: string; p_quantity: number }
        Returns: undefined
      }
      redeem_loyalty_to_order: { Args: { p_order_id: string }; Returns: number }
      reject_cancellation_request: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      reject_tenant: { Args: { p_tenant_id: string }; Returns: undefined }
      reorder_menu_categories: { Args: { p_ids: string[] }; Returns: undefined }
      reorder_product_extras: {
        Args: { p_ids: string[]; p_product_id: string }
        Returns: undefined
      }
      reorder_product_variants: {
        Args: { p_ids: string[]; p_product_id: string }
        Returns: undefined
      }
      reorder_products: {
        Args: { p_category_id: string; p_ids: string[] }
        Returns: undefined
      }
      request_account_deletion: { Args: never; Returns: undefined }
      request_loyalty_otp: {
        Args: {
          p_code_hash: string
          p_phone: string
          p_table_session_id: string
        }
        Returns: undefined
      }
      request_module: { Args: { p_module_key: string }; Returns: undefined }
      request_order_cancellation: {
        Args: { p_order_id: string; p_reason: string }
        Returns: undefined
      }
      reservation_overlap_range: {
        Args: { p_reserved_at: string }
        Returns: unknown
      }
      reset_staff_pin: {
        Args: { p_new_pin: string; p_profile_id: string }
        Returns: undefined
      }
      resolve_module_request: {
        Args: { p_approve: boolean; p_request_id: string }
        Returns: undefined
      }
      resolve_pending_module_removal: {
        Args: { p_keep: boolean; p_module_key: string; p_tenant_id: string }
        Returns: undefined
      }
      resolve_tenant_by_domain: {
        Args: { p_domain: string }
        Returns: {
          tenant_currency: string
          tenant_id: string
          tenant_slug: string
          tenant_status: string
          tenant_theme_key: string
        }[]
      }
      revoke_staff_device: { Args: { p_device_id: string }; Returns: undefined }
      seed_tenant_modules_from_plan: {
        Args: { p_tenant_id: string }
        Returns: undefined
      }
      set_monthly_goal: {
        Args: {
          p_branch_id: string
          p_period_month: string
          p_target_revenue_minor: number
        }
        Returns: undefined
      }
      set_plan_module: {
        Args: { p_included: boolean; p_module_key: string; p_plan_id: string }
        Returns: undefined
      }
      set_subscription_checkout_ref: {
        Args: { p_plan_id?: string; p_provider: string; p_provider_ref: string }
        Returns: undefined
      }
      set_tenant_module: {
        Args: {
          p_is_enabled: boolean
          p_module_key: string
          p_source: string
          p_tenant_id: string
        }
        Returns: undefined
      }
      submit_order: {
        Args: {
          p_delivery_address?: string
          p_delivery_zone_id?: string
          p_idempotency_key: string
          p_items: Json
          p_scheduled_for?: string
        }
        Returns: {
          order_id: string
          order_status: string
          subtotal_minor: number
        }[]
      }
      submit_rating: {
        Args: {
          p_comment?: string
          p_rated_staff_id?: string
          p_staff_stars?: number
          p_stars: number
        }
        Returns: string
      }
      submit_staff_order: {
        Args: { p_items: Json; p_table_id: string }
        Returns: {
          order_id: string
          order_status: string
          subtotal_minor: number
        }[]
      }
      suspend_tenant: { Args: { p_tenant_id: string }; Returns: undefined }
      trigger_scheduled_reports_digest: { Args: never; Returns: undefined }
      update_plan: {
        Args: {
          p_extra_branch_price_minor: number
          p_included_branch_count: number
          p_name: string
          p_plan_id: string
          p_price_minor: number
          p_table_limit: number
        }
        Returns: undefined
      }
      update_staff_member: {
        Args: {
          p_badge_no: string
          p_is_active: boolean
          p_profile_id: string
          p_role: string
        }
        Returns: undefined
      }
      update_tenant_business_settings: {
        Args: { p_currency: string; p_timezone: string }
        Returns: undefined
      }
      update_tenant_logo: { Args: { p_logo_url: string }; Returns: undefined }
      verify_loyalty_otp: {
        Args: {
          p_code_hash: string
          p_kvkk_consent: boolean
          p_phone: string
          p_table_session_id: string
        }
        Returns: string
      }
      verify_staff_device: {
        Args: { p_secret: string; p_tenant_id: string }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

