import autoAnimate from "@formkit/auto-animate";
import { zodResolver } from "@hookform/resolvers/zod";
import { SchedulingType } from "@prisma/client";
import { isValidPhoneNumber } from "libphonenumber-js";
import { EventTypeSetupInfered, FormValues } from "pages/v2/event-types/[type]";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm, useFormContext } from "react-hook-form";
import { z } from "zod";

import { getEventLocationType, EventLocationType } from "@calcom/app-store/locations";
import { CAL_URL, WEBAPP_URL } from "@calcom/lib/constants";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Icon } from "@calcom/ui/Icon";
import { Select, Label, TextField, Portal } from "@calcom/ui/v2";
import * as RadioArea from "@calcom/ui/v2/core/form/radio-area";

import { asStringOrUndefined } from "@lib/asStringOrNull";
import { slugify } from "@lib/slugify";

import CheckedSelect from "@components/ui/form/CheckedSelect";
import { EditLocationDialog } from "@components/v2/eventtype/EditLocationDialog";

type OptionTypeBase = {
  label: string;
  value: EventLocationType["type"];
  disabled?: boolean;
};

export const EventSetupTab = (
  props: Pick<EventTypeSetupInfered, "eventType" | "locationOptions" | "team" | "teamMembers">
) => {
  const { t } = useLocale();
  const formMethods = useFormContext<FormValues>();
  const { eventType, locationOptions, team, teamMembers } = props;

  const [showLocationModal, setShowLocationModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<OptionTypeBase | undefined>(undefined);

  const openLocationModal = (type: EventLocationType["type"]) => {
    setSelectedLocation(locationOptions.find((option) => option.value === type));
    setShowLocationModal(true);
  };

  const removeLocation = (selectedLocation: typeof eventType.locations[number]) => {
    formMethods.setValue(
      "locations",
      formMethods.getValues("locations").filter((location) => location.type !== selectedLocation.type),
      { shouldValidate: true }
    );
  };

  const addLocation = (newLocationType: EventLocationType["type"], details = {}) => {
    const existingIdx = formMethods.getValues("locations").findIndex((loc) => newLocationType === loc.type);
    if (existingIdx !== -1) {
      const copy = formMethods.getValues("locations");
      copy[existingIdx] = {
        ...formMethods.getValues("locations")[existingIdx],
        ...details,
      };
      formMethods.setValue("locations", copy);
    } else {
      formMethods.setValue(
        "locations",
        formMethods.getValues("locations").concat({ type: newLocationType, ...details })
      );
    }
    setShowLocationModal(false);
  };

  const schedulingTypeOptions: {
    value: SchedulingType;
    label: string;
    description: string;
  }[] = [
    {
      value: SchedulingType.COLLECTIVE,
      label: t("collective"),
      description: t("collective_description"),
    },
    {
      value: SchedulingType.ROUND_ROBIN,
      label: t("round_robin"),
      description: t("round_robin_description"),
    },
  ];

  const mapUserToValue = ({
    id,
    name,
    username,
  }: {
    id: number | null;
    name: string | null;
    username: string | null;
  }) => ({
    value: `${id || ""}`,
    label: `${name || ""}`,
    avatar: `${WEBAPP_URL}/${username}/avatar.png`,
  });

  const locationFormSchema = z.object({
    locationType: z.string(),
    locationAddress: z.string().optional(),
    displayLocationPublicly: z.boolean().optional(),
    locationPhoneNumber: z
      .string()
      .refine((val) => isValidPhoneNumber(val))
      .optional(),
    locationLink: z.string().url().optional(), // URL validates as new URL() - which requires HTTPS:// In the input field
  });

  const locationFormMethods = useForm<{
    locationType: EventLocationType["type"];
    locationPhoneNumber?: string;
    locationAddress?: string; // TODO: We should validate address or fetch the address from googles api to see if its valid?
    locationLink?: string; // Currently this only accepts links that are HTTPS://
    displayLocationPublicly?: boolean;
  }>({
    resolver: zodResolver(locationFormSchema),
  });

  const Locations = () => {
    const { t } = useLocale();
    const animationRef = useRef(null);

    useEffect(() => {
      animationRef.current && autoAnimate(animationRef.current);
    }, [animationRef]);

    const validLocations = formMethods.getValues("locations").filter((location) => {
      const eventLocation = getEventLocationType(location.type);
      if (!eventLocation) {
        // It's possible that the location app in use got uninstalled.
        return false;
      }
      return true;
    });

    return (
      <div className="w-full">
        {validLocations.length === 0 && (
          <div className="flex">
            <Select
              options={locationOptions}
              isSearchable={false}
              className="block w-full min-w-0 flex-1 rounded-sm text-sm"
              onChange={(e) => {
                if (e?.value) {
                  const newLocationType: EventLocationType["type"] = e.value;
                  const eventLocationType = getEventLocationType(newLocationType);
                  if (!eventLocationType) {
                    return;
                  }
                  locationFormMethods.setValue("locationType", newLocationType);
                  if (eventLocationType.organizerInputType) {
                    openLocationModal(newLocationType);
                  } else {
                    addLocation(newLocationType);
                  }
                }
              }}
            />
          </div>
        )}
        {validLocations.length > 0 && (
          <ul ref={animationRef}>
            {validLocations.map((location, index) => {
              const eventLocationType = getEventLocationType(location.type);
              if (!eventLocationType) {
                return null;
              }
              return (
                <li key={location.type} className="mb-2 rounded-sm border border-neutral-300 py-1.5 px-2">
                  <div className="flex justify-between">
                    <div key={index} className="flex flex-grow items-center">
                      <img
                        src={eventLocationType.iconUrl}
                        className="h-6 w-6"
                        alt={`${eventLocationType.label} logo`}
                      />
                      <span className="text-sm ltr:ml-2 rtl:mr-2">{eventLocationType.label}</span>
                    </div>
                    <div className="flex">
                      <button
                        type="button"
                        onClick={() => {
                          locationFormMethods.setValue("locationType", location.type);
                          locationFormMethods.unregister("locationLink");
                          locationFormMethods.unregister("locationAddress");
                          locationFormMethods.unregister("locationPhoneNumber");
                          openLocationModal(location.type);
                        }}
                        aria-label={t("edit")}
                        className="mr-1 p-1 text-gray-500 hover:text-gray-900">
                        <Icon.FiEdit2 className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => removeLocation(location)} aria-label={t("remove")}>
                        <Icon.FiX className="border-l-1 h-6 w-6 pl-1 text-gray-500 hover:text-gray-900 " />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
            {validLocations.length > 0 && validLocations.length !== locationOptions.length && (
              <li>
                <button
                  type="button"
                  className="flex rounded-sm py-2 hover:bg-gray-100"
                  onClick={() => setShowLocationModal(true)}>
                  <Icon.FiPlus className="mt-0.5 h-4 w-4 text-neutral-900" />
                  <span className="ml-1 text-sm font-medium text-neutral-700">{t("add_location")}</span>
                </button>
              </li>
            )}
          </ul>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="space-y-8">
        <TextField
          required
          label={t("Title")}
          defaultValue={eventType.title}
          {...formMethods.register("title")}
        />
        <TextField
          required
          label={t("description")}
          placeholder={t("quick_video_meeting")}
          defaultValue={eventType.description ?? ""}
          {...formMethods.register("description")}
        />
        <TextField
          required
          label={t("URL")}
          defaultValue={eventType.slug}
          addOnLeading={
            <>
              {CAL_URL?.replace(/^(https?:|)\/\//, "")}/
              {team ? "team/" + team.slug : eventType.users[0].username}/
            </>
          }
          {...formMethods.register("slug", {
            setValueAs: (v) => slugify(v),
          })}
        />
        <TextField
          required
          name="length"
          type="number"
          label={t("duration")}
          addOnSuffix={<>{t("minutes")}</>}
          defaultValue={eventType.length ?? 15}
          onChange={(e) => {
            formMethods.setValue("length", Number(e.target.value));
          }}
        />
        <div>
          <Label>{t("location")}</Label>
          <Controller
            name="locations"
            control={formMethods.control}
            defaultValue={eventType.locations || []}
            render={() => <Locations />}
          />
        </div>
      </div>

      {team && (
        <div className="space-y-3">
          <div className="block sm:flex">
            <div className="min-w-48 mb-4 sm:mb-0">
              <label htmlFor="schedulingType" className="mt-2 flex text-sm font-medium text-neutral-700">
                <Icon.FiUsers className="h-5 w-5 text-neutral-500 ltr:mr-2 rtl:ml-2" /> {t("scheduling_type")}
              </label>
            </div>
            <Controller
              name="schedulingType"
              control={formMethods.control}
              defaultValue={eventType.schedulingType}
              render={() => (
                <RadioArea.Select
                  value={asStringOrUndefined(eventType.schedulingType)}
                  options={schedulingTypeOptions}
                  onChange={(val) => {
                    // FIXME: Better types are needed
                    formMethods.setValue("schedulingType", val as SchedulingType);
                  }}
                />
              )}
            />
          </div>

          <div className="block sm:flex">
            <div className="min-w-48 mb-4 sm:mb-0">
              <label htmlFor="users" className="flex text-sm font-medium text-neutral-700">
                <Icon.FiUserPlus className="h-5 w-5 text-neutral-500 ltr:mr-2 rtl:ml-2" /> {t("attendees")}
              </label>
            </div>
            <div className="w-full space-y-2">
              <Controller
                name="users"
                control={formMethods.control}
                defaultValue={eventType.users.map((user) => user.id.toString())}
                render={({ field: { onChange, value } }) => (
                  <CheckedSelect
                    isDisabled={false}
                    onChange={(options) => onChange(options.map((user) => user.value))}
                    value={value
                      .map(
                        (userId) =>
                          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                          teamMembers.map(mapUserToValue).find((member) => member.value === userId)!
                      )
                      .filter(Boolean)}
                    options={teamMembers.map(mapUserToValue)}
                    placeholder={t("add_attendees")}
                  />
                )}
              />
            </div>
          </div>
        </div>
      )}

      {/* We portal this modal so we can submit the form inside. Otherwise we get issues submitting two forms at once  */}
      <EditLocationDialog
        isOpenDialog={showLocationModal}
        setShowLocationModal={setShowLocationModal}
        saveLocation={addLocation}
        defaultValues={formMethods.getValues("locations")}
        selection={
          selectedLocation ? { value: selectedLocation.value, label: selectedLocation.label } : undefined
        }
        setSelectedLocation={setSelectedLocation}
      />
    </div>
  );
};