package cmd

import (
	"github.com/hieudoanm/tax/src/ui"

	"github.com/spf13/cobra"
)

/* =======================
   COMMAND
======================= */

var calculateCmd = &cobra.Command{
	Use:   "calculate",
	Short: "Run the calculate operation for the tax app",
	RunE: func(cmd *cobra.Command, args []string) error {
		return ui.RunTaxTUI()
	},
}

func init() {
	rootCmd.AddCommand(calculateCmd)
}
