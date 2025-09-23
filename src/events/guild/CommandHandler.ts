import { ChatInputCommandInteraction, Collection, EmbedBuilder, Events } from "discord.js";
import CustomClient from "../../base/classes/CustomClient";
import Event from "../../base/classes/Event";
import Command from "../../base/classes/Command";
import { configDotenv } from "dotenv";

export default class CommandHandler extends Event {
    constructor(client: CustomClient) {
        super(client, {
            name: Events.InteractionCreate,
            description: "Command handler event",
            once: false
        })
    }

    async Execute(interaction: ChatInputCommandInteraction) {
        configDotenv();

        if (!interaction.isChatInputCommand()) return;

    const command: Command = this.client.commands.get(interaction.commandName)!;

        console.log("Received command: " + interaction.commandName);

        // Defer quickly; use ephemeral option supported by discord.js v14
        try {
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply({ ephemeral: !!command?.ephemeral });
            }
        } catch (err: any) {
            const code = err?.code ?? err?.status;
            if (code === 10062 /* Unknown interaction */) {
                console.warn(`Ignoring unknown/expired interaction for command '${interaction.commandName}'.`);
                return;
            }
            console.error("Failed to defer reply:", err);
            return;
        }

        if (!command) {
            try { await interaction.editReply({ content: "This command does not exist!" }); } catch {}
            this.client.commands.delete(interaction.commandName);
            return;
        }

        if (command.dev && !process.env.devUID.includes(interaction.user.id)) {
            try {
                return await interaction.editReply({ embeds: [new EmbedBuilder()
                    .setColor("Red")
                    .setDescription(`❌ This command is only available to developers.`)
                ]});
            } catch { return; }
        }

        const { cooldowns } = this.client;
        if (!cooldowns.has(command.name)) cooldowns.set(command.name, new Collection());

        const now = Date.now();
        const timestamps = cooldowns.get(command.name)!;
        const cooldownAmount = (command.cooldown || 3) * 1000;

        if (timestamps.has(interaction.user.id) && (now < (timestamps.get(interaction.user.id) || 0) + cooldownAmount)) {
            try {
                return await interaction.editReply({
                    embeds: [new EmbedBuilder()
                        .setColor("Red")
                        .setDescription(`❌ Please wait another \`${((((timestamps.get(interaction.user.id) || 0) + cooldownAmount) - now) / 1000).toFixed(1)}\` seconds to run this command.`)
                    ]
                });
            } catch { return; }
        }
        
        timestamps.set(interaction.user.id, now);
        setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

        try {
            const subCommandGroup = interaction.options.getSubcommandGroup(false);
            const subCommand = `${interaction.commandName}${subCommandGroup ? `.${subCommandGroup}` : ""}.${interaction.options.getSubcommand(false) || ""}`;

            return this.client.subCommands.get(subCommand)?.Execute(interaction) || command.Execute(interaction);
        } catch (err) {
            console.error(err);
        }
    }
}
