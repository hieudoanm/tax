package cmd

import (
	"tax-cli/ui"

	"github.com/spf13/cobra"
)

/* =======================
   COMMAND
======================= */

var calculateCmd = &cobra.Command{
	Use:   "calculate",
	Short: "Tính thuế thu nhập cá nhân Việt Nam (interactive)",
	RunE: func(cmd *cobra.Command, args []string) error {
		return ui.RunTaxTUI()
	},
}

func init() {
	rootCmd.AddCommand(calculateCmd)
}
